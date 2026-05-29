import { logger, normalizeError } from "../../utils/logger";
import {
	type WorkflowProgressEvent,
	addWorkflowProgressListener,
} from "../server";
import type { ResolvedProjectConfig, RunState } from "../types";
import { createReliableWorkflowDataClient } from "./reliable-workflow-data-client";
import { enrichUsageRecord } from "./usage-cost";
import type {
	WorkflowDataAction,
	WorkflowTaskExecutionStreamInput,
	WorkflowTaskExecutionUsageInput,
} from "./workflow-data-protocol";

type ExecutionFinishStatus = "succeeded" | "failed";

export interface WorkflowExecutionRecorder {
	executionLogId: string;
	start(): Promise<void>;
	finish(status: ExecutionFinishStatus): Promise<void>;
}

export function createWorkflowExecutionRecorder(
	config: ResolvedProjectConfig,
	state: RunState,
): WorkflowExecutionRecorder {
	const executionLogId = crypto.randomUUID();
	const client = createReliableWorkflowDataClient({
		context: { workspacePath: config.workspacePath, projectId: config.id },
	});
	let sequence = 0;
	let tail = Promise.resolve();
	let unsubscribe: (() => void) | undefined;
	let disabled = false;
	let usageStartIndex = state.codexUsage?.length ?? 0;

	const enqueue = (action: WorkflowDataAction, payload: unknown): void => {
		tail = tail
			.then(() => client.request(action, payload))
			.then(
				() => undefined,
				() => undefined,
			);
	};

	return {
		executionLogId,
		async start() {
			usageStartIndex = state.codexUsage?.length ?? 0;
			try {
				await client.request("taskExecutions.start", {
					executionLogId,
					taskId: state.issue.id,
					projectId: state.projectId,
					issueKey: state.issue.key,
					startedAt: new Date().toISOString(),
				});
			} catch (error) {
				if (!isTaskNotFound(error)) {
					throw error;
				}
				disabled = true;
				logger.warn(
					{
						taskId: state.issue.id,
						projectId: state.projectId,
						issueKey: state.issue.key,
						err: normalizeError(error),
					},
					"Task execution logging disabled because server task was not found",
				);
				return;
			}
			unsubscribe = addWorkflowProgressListener((event) => {
				if (!matchesRunState(event, state)) {
					return;
				}
				sequence += 1;
				if (event.kind === "log") {
					enqueue("taskExecutions.appendStream", {
						executionLogId,
						eventId: eventId(executionLogId, sequence),
						...streamMetadata(event),
						stream: event.stream,
						text: event.message,
						emittedAt: event.emittedAt,
					});
					return;
				}
				enqueue("taskExecutions.recordProgress", {
					executionLogId,
					eventId: eventId(executionLogId, sequence),
					stepNumber: sequence,
					event,
				});
			});
		},
		async finish(status) {
			if (disabled) {
				return;
			}
			unsubscribe?.();
			await tail;
			await client.request("taskExecutions.finish", {
				executionLogId,
				status,
				finishedAt: new Date().toISOString(),
				usage: buildExecutionUsage(
					config,
					state,
					executionLogId,
					usageStartIndex,
				),
			});
		},
	};
}

function buildExecutionUsage(
	config: ResolvedProjectConfig,
	state: RunState,
	executionLogId: string,
	startIndex: number,
): WorkflowTaskExecutionUsageInput[] {
	return (state.codexUsage ?? []).slice(startIndex).map((usage, index) => {
		const enriched = enrichUsageRecord(
			config,
			usage.stage,
			usage,
			usage.recordedAt,
		);
		return {
			id: `${executionLogId}:usage:${String(index + 1).padStart(4, "0")}`,
			runId: `${state.projectId}:${state.issue.key}:${state.startedAt}`,
			stage: enriched.stage,
			agentBackend: enriched.agentBackend,
			model: enriched.model,
			inputTokens: enriched.inputTokens ?? 0,
			outputTokens: enriched.outputTokens ?? 0,
			totalTokens:
				enriched.totalTokens ??
				(enriched.inputTokens ?? 0) + (enriched.outputTokens ?? 0),
			estimatedCostMicrousd: enriched.estimatedCostMicrousd,
			recordedAt: enriched.recordedAt,
		};
	});
}

function matchesRunState(
	event: WorkflowProgressEvent,
	state: RunState,
): boolean {
	if (event.projectId !== state.projectId) {
		return false;
	}
	return event.issueKey === state.issue.key;
}

function streamMetadata(
	event: WorkflowProgressEvent,
): Partial<WorkflowTaskExecutionStreamInput> {
	return {
		projectId: event.projectId,
		taskId: event.taskId,
		issueKey: event.issueKey,
		stage: event.stage,
		agentRole: event.agentRole,
		agentBackend: event.agentBackend,
		agentModel: event.agentModel,
		phrase: event.phrase,
	};
}

function eventId(executionLogId: string, sequence: number): string {
	return `${executionLogId}:${String(sequence).padStart(6, "0")}`;
}

function isTaskNotFound(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return message.startsWith("not_found: Task not found");
}
