import type { ServerDatabase } from "../db";
import type { RealtimeEventPublisher } from "../realtime";
import { createTaskRepository, createTaskService } from "../tasks";
import {
	addComment,
	createIntakeTask,
	createTask,
	getTaskByKey,
	linkPullRequest,
	listTasks,
	recordPolling,
	updateTask,
	type TaskCommentRequest,
	type TaskPullRequestRequest,
	type TaskUpdateRequest,
} from "./workflow-data-actions";
import type {
	WorkflowDataAction,
	WorkflowDataService,
	WorkflowPollingRecordInput,
	WorkflowTaskCreatePayload,
} from "./workflow-data.types";
import { WorkflowDataError, workflowError } from "./workflow-data-error";

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
			return createTask(context, readPayload<WorkflowTaskCreatePayload>(payload));
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
			return linkPullRequest(context, readPayload<TaskPullRequestRequest>(payload));
		case "polling.record":
			await recordPolling(context, readPayload<WorkflowPollingRecordInput>(payload));
			return { recorded: true };
	}
}

function readPayload<T>(payload: unknown): T {
	if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
		throw workflowError("invalid_payload", "Workflow payload must be an object");
	}
	return payload as T;
}

export { WorkflowDataError, workflowError };
