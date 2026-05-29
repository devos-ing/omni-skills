import type { ServerDatabase } from "devos-db";
import type { RealtimeEventPublisher } from "../realtime";
import { createTaskRepository, createTaskService } from "../tasks";
import type {
	WorkflowChatClarificationQuestion,
	WorkflowDataAction,
	WorkflowDataService,
	WorkflowPollingRecordInput,
	WorkflowTaskCreatePayload,
	WorkflowTaskExecutionFinishInput,
	WorkflowTaskExecutionProgressInput,
	WorkflowTaskExecutionStartInput,
	WorkflowTaskExecutionStreamInput,
} from "./types/workflow-data.types";
import {
	type TaskCommentRequest,
	type TaskPullRequestRequest,
	type TaskUpdateRequest,
	addComment,
	createIntakeTask,
	createTask,
	getTaskByKey,
	linkPullRequest,
	listTasks,
	recordPolling,
	updateTask,
} from "./workflow-data-actions";
import {
	listChatClarificationAnswers,
	publishChatClarification,
} from "./workflow-data-chat-actions";
import { WorkflowDataError, workflowError } from "./workflow-data-error";
import {
	appendTaskExecutionStream,
	finishTaskExecution,
	recordTaskExecutionProgress,
	startTaskExecution,
} from "./workflow-execution-actions";

export function createWorkflowDataService(
	db: ServerDatabase["db"],
	realtimeEvents?: RealtimeEventPublisher,
): WorkflowDataService {
	const taskService = createTaskService(createTaskRepository(db));
	const context = { db, realtimeEvents, taskService };
	return {
		async handle(action, payload) {
			return handleWorkflowAction(context, action, payload);
		},
	};
}

async function handleWorkflowAction(
	context: Parameters<typeof listTasks>[0],
	action: WorkflowDataAction,
	payload: unknown,
): Promise<unknown | undefined> {
	switch (action) {
		case "tasks.list":
			return listTasks(context);
		case "tasks.getByKey":
			return getTaskByKey(context, readPayload<{ taskKey: string }>(payload));
		case "tasks.createWorkflowTask":
			return createTask(
				context,
				readPayload<WorkflowTaskCreatePayload>(payload),
			);
		case "tasks.createIntakeTask":
			return createIntakeTask(
				context,
				readPayload<{ projectId: string; title: string; description: string }>(
					payload,
				),
			);
		case "tasks.update":
			return updateTask(context, readPayload<TaskUpdateRequest>(payload));
		case "tasks.addComment":
			return addComment(context, readPayload<TaskCommentRequest>(payload));
		case "tasks.linkPullRequest":
			return linkPullRequest(
				context,
				readPayload<TaskPullRequestRequest>(payload),
			);
		case "chat.publishClarification":
			return publishChatClarification(
				context,
				readPayload<{
					taskId: string;
					questions: WorkflowChatClarificationQuestion[];
				}>(payload),
			);
		case "chat.listClarificationAnswers":
			return listChatClarificationAnswers(
				context,
				readPayload<{ taskId: string }>(payload),
			);
		case "taskExecutions.start":
			return startTaskExecution(
				context,
				readPayload<WorkflowTaskExecutionStartInput>(payload),
			);
		case "taskExecutions.appendStream":
			return appendTaskExecutionStream(
				context,
				readPayload<WorkflowTaskExecutionStreamInput>(payload),
			);
		case "taskExecutions.recordProgress":
			return recordTaskExecutionProgress(
				context,
				readPayload<WorkflowTaskExecutionProgressInput>(payload),
			);
		case "taskExecutions.finish":
			return finishTaskExecution(
				context,
				readPayload<WorkflowTaskExecutionFinishInput>(payload),
			);
		case "polling.record":
			await recordPolling(
				context,
				readPayload<WorkflowPollingRecordInput>(payload),
			);
			return { recorded: true };
	}
}

function readPayload<T>(payload: unknown): T {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw workflowError(
			"invalid_payload",
			"Workflow payload must be an object",
		);
	}
	return payload as T;
}

export { WorkflowDataError, workflowError };
