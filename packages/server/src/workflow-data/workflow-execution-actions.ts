import { and, eq } from "devos-db";
import {
	boardTasksTable,
	taskExecutionLogsTable,
	taskExecutionStepsTable,
} from "devos-db";
import type { RealtimeEventPublisher } from "../realtime";
import type {
	WorkflowTaskExecutionFinishInput,
	WorkflowTaskExecutionProgressInput,
	WorkflowTaskExecutionStartInput,
	WorkflowTaskExecutionStreamInput,
} from "./types/workflow-data.types";
import type { WorkflowDataContext } from "./workflow-data-actions";
import { workflowError } from "./workflow-data-error";
import { streamExecutionMetadata } from "./workflow-execution-stream-metadata";
import { appendMarkedStream, streamEventMarker } from "./workflow-stream-log";
import { recordTaskExecutionUsage } from "./workflow-token-usage-actions";

type ExecutionRealtimeEvent = Extract<
	Parameters<RealtimeEventPublisher["publish"]>[0],
	{ type: "task.execution.event" }
>["execution"]["event"];

export async function startTaskExecution(
	context: WorkflowDataContext,
	input: WorkflowTaskExecutionStartInput,
) {
	const taskId = await resolveExecutionTaskId(context, input);
	await context.db
		.insert(taskExecutionLogsTable)
		.values({
			id: input.executionLogId,
			taskId,
			status: input.status ?? "running",
			startedAt: input.startedAt ?? new Date().toISOString(),
			finishedAt: null,
			log: input.log ?? "",
		})
		.onConflictDoNothing();
	const log = await readExecutionLog(context, input.executionLogId);
	publishExecutionEvent(
		context.realtimeEvents,
		log.taskId,
		input.executionLogId,
		{
			kind: "action",
			action: "execution-log",
			status: "started",
		},
	);
	return log;
}

export async function appendTaskExecutionStream(
	context: WorkflowDataContext,
	input: WorkflowTaskExecutionStreamInput,
) {
	const existing = await readExecutionLog(context, input.executionLogId);
	const marker = streamEventMarker(input.eventId);
	if (!existing.log.includes(marker)) {
		await context.db
			.update(taskExecutionLogsTable)
			.set({ log: appendMarkedStream(existing.log, marker, input) })
			.where(eq(taskExecutionLogsTable.id, input.executionLogId));
	}
	publishExecutionEvent(
		context.realtimeEvents,
		existing.taskId,
		input.executionLogId,
		{
			kind: "log",
			...streamExecutionMetadata(input, existing.taskId),
			stream: input.stream,
			level: input.stream === "stderr" ? "error" : "info",
			message: input.text,
			emittedAt: input.emittedAt,
		},
	);
	return readExecutionLog(context, input.executionLogId);
}

export async function recordTaskExecutionProgress(
	context: WorkflowDataContext,
	input: WorkflowTaskExecutionProgressInput,
) {
	const existing = await readExecutionLog(context, input.executionLogId);
	await context.db
		.insert(taskExecutionStepsTable)
		.values({
			id: input.eventId,
			executionLogId: input.executionLogId,
			stepNumber: input.stepNumber,
			action: progressAction(input.event),
			status: progressStatus(input.event),
			detail: JSON.stringify(input.event),
			recordedAt: input.event.emittedAt,
		})
		.onConflictDoNothing();
	context.realtimeEvents?.publish({
		type: "task.execution.event",
		execution: {
			taskId: existing.taskId,
			executionLogId: input.executionLogId,
			event: input.event as ExecutionRealtimeEvent,
		},
	});
	return readExecutionLog(context, input.executionLogId);
}

export async function finishTaskExecution(
	context: WorkflowDataContext,
	input: WorkflowTaskExecutionFinishInput,
) {
	const existing = await readExecutionLog(context, input.executionLogId);
	const finishedAt =
		existing.finishedAt ?? input.finishedAt ?? new Date().toISOString();
	await recordTaskExecutionUsage(context, {
		executionLogId: input.executionLogId,
		taskId: existing.taskId,
		usage: input.usage,
	});
	await context.db
		.update(taskExecutionLogsTable)
		.set({ status: input.status, finishedAt })
		.where(eq(taskExecutionLogsTable.id, input.executionLogId));
	publishExecutionEvent(
		context.realtimeEvents,
		existing.taskId,
		input.executionLogId,
		{
			kind: "action",
			action: "execution-log",
			status: input.status,
			emittedAt: finishedAt,
		},
	);
	return readExecutionLog(context, input.executionLogId);
}

async function resolveExecutionTaskId(
	context: WorkflowDataContext,
	input: WorkflowTaskExecutionStartInput,
): Promise<string> {
	if (input.taskId) {
		const taskId = await resolveTaskId(context, input.taskId);
		if (taskId) return taskId;
		if (!input.projectId || !input.issueKey) {
			throw workflowError("not_found", "Task not found");
		}
	}
	if (!input.projectId || !input.issueKey) {
		throw workflowError(
			"invalid_payload",
			"taskId or projectId plus issueKey is required",
		);
	}
	const taskId = await resolveTaskIdByProjectKey(context, {
		projectId: input.projectId,
		issueKey: input.issueKey,
	});
	if (taskId) return taskId;
	throw workflowError("not_found", "Task not found");
}

async function resolveTaskId(
	context: WorkflowDataContext,
	taskId: string,
): Promise<string | undefined> {
	const result = await context.taskService.getTask(taskId);
	return result.status === "ok" ? result.value.id : undefined;
}

async function resolveTaskIdByProjectKey(
	context: WorkflowDataContext,
	input: { projectId: string; issueKey: string },
): Promise<string | undefined> {
	const [task] = await context.db
		.select({ id: boardTasksTable.id })
		.from(boardTasksTable)
		.where(
			and(
				eq(boardTasksTable.taskKey, input.issueKey),
				eq(boardTasksTable.projectId, input.projectId),
			),
		);
	return task?.id;
}

async function readExecutionLog(
	context: WorkflowDataContext,
	executionLogId: string,
) {
	const [log] = await context.db
		.select()
		.from(taskExecutionLogsTable)
		.where(eq(taskExecutionLogsTable.id, executionLogId));
	if (!log) throw workflowError("not_found", "Execution log not found");
	return log;
}

function progressAction(event: WorkflowTaskExecutionProgressInput["event"]) {
	if (event.kind === "action") return stringField(event.action, "action");
	if (event.kind === "stage") {
		return `stage:${stringField(event.stage, "unknown")}`;
	}
	if (event.kind === "checkpoint") {
		return `checkpoint:${stringField(event.title, "unknown")}`;
	}
	return event.kind;
}

function progressStatus(event: WorkflowTaskExecutionProgressInput["event"]) {
	if ("status" in event && typeof event.status === "string") {
		return event.status;
	}
	return "recorded";
}

function stringField(value: unknown, fallback: string): string {
	return typeof value === "string" && value.trim() ? value : fallback;
}

function publishExecutionEvent(
	realtimeEvents: RealtimeEventPublisher | undefined,
	taskId: string,
	executionLogId: string,
	event: Record<string, unknown>,
): void {
	const { emittedAt: eventEmittedAt, ...eventPayload } = event;
	const emittedAt =
		typeof eventEmittedAt === "string"
			? eventEmittedAt
			: new Date().toISOString();
	realtimeEvents?.publish({
		type: "task.execution.event",
		execution: {
			taskId,
			executionLogId,
			event: {
				...eventPayload,
				schema: "devos.workflow.stream.v1",
				emittedAt,
			} as ExecutionRealtimeEvent,
		},
	});
}
