import { eq } from "devos-db";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	recordPollingEvent,
	recordPollingStatus,
	taskCommentsTable,
	taskPullRequestsTable,
} from "devos-db";
import type { RealtimeEventPublisher } from "../realtime";
import type { createTaskService } from "../tasks";
import type { BoardTaskApiRecord } from "../tasks/types/task-service.types";
import type {
	WorkflowBoardTaskRecord,
	WorkflowPollingRecordInput,
	WorkflowPullRequestRecord,
	WorkflowTaskCreatePayload,
	WorkflowTaskUpdatePayload,
} from "./types/workflow-data.types";
import { workflowError } from "./workflow-data-error";
import { parsePrNumber, withPullRequests } from "./workflow-data-mappers";

const DEFAULT_TASK_CREATOR_ID = "member-1";
const DEFAULT_TASK_PRIORITY = 1;
const DEFAULT_TASK_STATUS = "plan";

export interface WorkflowDataContext {
	db: ServerDatabase["db"];
	realtimeEvents?: RealtimeEventPublisher;
	taskService: ReturnType<typeof createTaskService>;
}

export interface TaskUpdateRequest {
	taskId: string;
	values: WorkflowTaskUpdatePayload;
}

export interface TaskCommentRequest {
	taskId: string;
	body: string;
	commentId?: string;
}

export interface TaskPullRequestRequest {
	taskId: string;
	repository: string;
	pullRequest: WorkflowPullRequestRecord;
}

export async function listTasks(
	context: WorkflowDataContext,
): Promise<WorkflowBoardTaskRecord[]> {
	const result = await context.taskService.listTasks();
	if (result.status !== "ok") {
		throw workflowError("task_list_failed", "Failed to list workflow tasks");
	}
	return withPullRequests(context.db, result.value);
}

export async function getTaskByKey(
	context: WorkflowDataContext,
	input: { taskKey: string },
): Promise<WorkflowBoardTaskRecord | null> {
	const tasks = await listTasks(context);
	return tasks.find((task) => task.taskKey === input.taskKey) ?? null;
}

export async function createTask(
	context: WorkflowDataContext,
	input: WorkflowTaskCreatePayload,
): Promise<WorkflowBoardTaskRecord> {
	const result = await context.taskService.createTask(input);
	const task = assertTaskResult(result, "Task creation failed");
	context.realtimeEvents?.publish({ type: "issue.created", issue: task });
	return (await withPullRequests(context.db, [task]))[0] ?? task;
}

export async function createIntakeTask(
	context: WorkflowDataContext,
	input: { projectId: string; title: string; description: string },
): Promise<WorkflowBoardTaskRecord> {
	const project = await resolveBoardProject(context.db, input.projectId);
	return createTask(context, {
		projectId: project?.id ?? null,
		title: input.title,
		content: input.description,
		priority: DEFAULT_TASK_PRIORITY,
		status: DEFAULT_TASK_STATUS,
		dueDate: null,
		creatorId: project?.ownerId ?? DEFAULT_TASK_CREATOR_ID,
		linkedPr: null,
	});
}

export async function updateTask(
	context: WorkflowDataContext,
	input: TaskUpdateRequest,
): Promise<WorkflowBoardTaskRecord> {
	const result = await context.taskService.updateTask(
		input.taskId,
		input.values,
	);
	const task = assertTaskResult(result, "Task update failed");
	context.realtimeEvents?.publish({ type: "issue.updated", issue: task });
	return (await withPullRequests(context.db, [task]))[0] ?? task;
}

export async function addComment(
	context: WorkflowDataContext,
	input: TaskCommentRequest,
): Promise<WorkflowBoardTaskRecord> {
	const existing = await context.taskService.getTask(input.taskId);
	assertTaskResult(existing, "Task read failed");
	const now = new Date().toISOString();
	await context.db
		.insert(taskCommentsTable)
		.values({
			id: input.commentId ?? crypto.randomUUID(),
			taskId: input.taskId,
			authorId: "devos",
			authorType: "agent",
			comment: input.body,
			createdAt: now,
		})
		.onConflictDoNothing();
	const [task] = await context.db
		.update(boardTasksTable)
		.set({ updatedAt: now })
		.where(eq(boardTasksTable.id, input.taskId))
		.returning();
	if (!task) {
		throw workflowError("not_found", "Task not found");
	}
	const refreshed = assertTaskResult(
		await context.taskService.getTask(input.taskId),
		"Task read failed",
	);
	context.realtimeEvents?.publish({
		type: "issue.updated",
		issue: refreshed,
	});
	return (await withPullRequests(context.db, [refreshed]))[0] ?? refreshed;
}

export async function linkPullRequest(
	context: WorkflowDataContext,
	input: TaskPullRequestRequest,
): Promise<WorkflowBoardTaskRecord> {
	const updated = await updateTask(context, {
		taskId: input.taskId,
		values: { linkedPr: input.pullRequest.url ?? null },
	});
	const prNumber =
		input.pullRequest.number ?? parsePrNumber(input.pullRequest.url);
	if (prNumber) {
		await upsertPullRequest(context, input, prNumber);
	}
	return { ...updated, pullRequest: input.pullRequest };
}

export async function recordPolling(
	context: WorkflowDataContext,
	input: WorkflowPollingRecordInput,
): Promise<void> {
	await recordPollingStatus({ db: context.db, ...input });
	await recordPollingEvent({ db: context.db, ...input });
	context.realtimeEvents?.publish({
		type: "polling.event",
		polling: {
			pollerId: input.pollerId,
			eventType: input.eventType,
			level: input.level,
			message: input.message,
		},
	});
}

async function upsertPullRequest(
	context: WorkflowDataContext,
	input: TaskPullRequestRequest,
	prNumber: number,
): Promise<void> {
	await context.db
		.insert(taskPullRequestsTable)
		.values({
			id: crypto.randomUUID(),
			taskId: input.taskId,
			repository: input.repository,
			prNumber: String(prNumber),
			prUrl: input.pullRequest.url ?? null,
			branch: input.pullRequest.branch,
			createdAt: new Date().toISOString(),
		})
		.onConflictDoUpdate({
			target: [
				taskPullRequestsTable.taskId,
				taskPullRequestsTable.repository,
				taskPullRequestsTable.prNumber,
			],
			set: {
				branch: input.pullRequest.branch,
				prUrl: input.pullRequest.url ?? null,
			},
		});
}

function assertTaskResult(
	result: Awaited<ReturnType<WorkflowDataContext["taskService"]["getTask"]>>,
	message: string,
): BoardTaskApiRecord {
	if (result.status === "ok") {
		return result.value;
	}
	if (result.status === "not_found") {
		throw workflowError("not_found", "Task not found");
	}
	throw workflowError(result.status, message);
}

async function resolveBoardProject(
	db: ServerDatabase["db"],
	projectId: string,
): Promise<{ id: string; ownerId: string } | null> {
	const [project] = await db
		.select({ id: boardProjectsTable.id, ownerId: boardProjectsTable.ownerId })
		.from(boardProjectsTable)
		.where(eq(boardProjectsTable.id, projectId));
	return project ?? null;
}
