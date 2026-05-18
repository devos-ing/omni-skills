import type { WorkflowBoardTaskRecord } from "devos-server/workflow-data";
import { createWorkflowDataClient } from "../workflow/workflow-data-client";
import type { ResolvedProjectConfig } from "../types";
import type {
	TaskIntakeCreatedTask,
	TaskIntakeTask,
	TaskIntakeTaskCreator,
} from "./task-intake.types";

export function createBoardTaskCreator(
	config: ResolvedProjectConfig,
): TaskIntakeTaskCreator {
	const client = createWorkflowDataClient();
	return {
		async createTask(input) {
			const task = await client.request<WorkflowBoardTaskRecord>(
				"tasks.createIntakeTask",
				toCreatePayload(config, input),
			);
			return toCreatedTask(task);
		},
	};
}

function toCreatePayload(config: ResolvedProjectConfig, input: TaskIntakeTask) {
	return {
		projectId: config.id,
		title: input.title,
		description: input.description,
	};
}

function toCreatedTask(
	task: WorkflowBoardTaskRecord,
): TaskIntakeCreatedTask {
	return {
		id: task.id,
		taskKey: task.taskKey,
		projectId: task.projectId,
		title: task.title,
		content: task.content,
		priority: task.priority,
		status: task.status,
		dueDate: task.dueDate,
		creatorId: task.creatorId,
		linkedPr: task.linkedPr,
		linearIssueId: task.linearIssueId,
		linearIdentifier: task.linearIdentifier,
		linearUrl: task.linearUrl,
		createdAt: task.createdAt,
		updatedAt: task.updatedAt,
	};
}
