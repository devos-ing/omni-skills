import { logger, normalizeError } from "../../utils/logger";
import type { WorkflowDataOutboxContext } from "./types/workflow-data-outbox.types";
import {
	type WorkflowDataClientOptions,
	createWorkflowDataClient,
} from "./workflow-data-client";
import {
	drainWorkflowDataOutbox,
	enqueueWorkflowDataOutboxEntry,
} from "./workflow-data-outbox";
import type { WorkflowDataAction } from "./workflow-data-protocol";

const BUFFERABLE_ACTIONS = new Set<WorkflowDataAction>([
	"tasks.update",
	"tasks.addComment",
	"tasks.linkPullRequest",
	"chat.publishClarification",
	"taskExecutions.start",
	"taskExecutions.appendStream",
	"taskExecutions.recordProgress",
	"taskExecutions.finish",
	"polling.record",
]);
const loggedBufferedActions = new Set<string>();
const loggedDrainFailures = new Set<string>();

export interface ReliableWorkflowDataClientOptions
	extends WorkflowDataClientOptions {
	context: WorkflowDataOutboxContext;
}

export function createReliableWorkflowDataClient(
	options: ReliableWorkflowDataClientOptions,
) {
	const client = createWorkflowDataClient(options);
	return {
		async request<T>(
			action: WorkflowDataAction,
			payload?: unknown,
		): Promise<T> {
			await drainOutboxBestEffort(options.context, client.request);
			try {
				const response = await client.request<T>(action, payload);
				await drainOutboxBestEffort(options.context, client.request);
				return response;
			} catch (error) {
				if (
					!BUFFERABLE_ACTIONS.has(action) ||
					!isRetryableWorkflowError(error)
				) {
					throw error;
				}
				await enqueueWorkflowDataOutboxEntry(
					options.context,
					action,
					payload,
					error,
				);
				logBufferedMutation(options.context, action, error);
				return undefined as T;
			}
		},
	};
}

function isRetryableWorkflowError(error: unknown): boolean {
	const message = error instanceof Error ? error.message : String(error);
	return (
		message.includes("Workflow websocket failed") ||
		message.includes("Workflow websocket timed out") ||
		message.includes("Workflow websocket closed")
	);
}

export async function drainProjectWorkflowDataOutbox(
	context: WorkflowDataOutboxContext,
	options: WorkflowDataClientOptions = {},
) {
	const client = createWorkflowDataClient(options);
	return drainWorkflowDataOutbox(context, client.request);
}

async function drainOutboxBestEffort(
	context: WorkflowDataOutboxContext,
	send: (action: WorkflowDataAction, payload: unknown) => Promise<unknown>,
): Promise<void> {
	const result = await drainWorkflowDataOutbox(context, send);
	if (result.error) {
		logDrainDeferred(context, result.remaining, result.error);
	}
}

function logBufferedMutation(
	context: WorkflowDataOutboxContext,
	action: WorkflowDataAction,
	error: unknown,
): void {
	const key = `${context.projectId}:${action}`;
	if (loggedBufferedActions.has(key)) {
		return;
	}
	loggedBufferedActions.add(key);
	logger.warn(
		{
			projectId: context.projectId,
			action,
			err: normalizeError(error),
		},
		action === "polling.record"
			? "Workflow data reporting unavailable; buffered polling status for retry"
			: "Buffered workflow server mutation for retry",
	);
}

function logDrainDeferred(
	context: WorkflowDataOutboxContext,
	remaining: number,
	error: string,
): void {
	if (loggedDrainFailures.has(context.projectId)) {
		return;
	}
	loggedDrainFailures.add(context.projectId);
	logger.warn(
		{
			projectId: context.projectId,
			remaining,
			err: error,
		},
		"Workflow server outbox drain deferred",
	);
}
