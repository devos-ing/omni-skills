import { and, eq, inArray } from "devos-db";
import type { ServerDatabase } from "devos-db";
import {
	boardProjectsTable,
	boardTasksTable,
	generateBoardTaskKey,
	inboxMessagesTable,
	taskAssigneesTable,
	taskCommentsTable,
	taskExecutionLogsTable,
	taskExecutionStepsTable,
	taskPullRequestsTable,
	taskTagsTable,
	tokenUsageTable,
} from "devos-db";
import type { BoardTaskRow, NewBoardTaskRow } from "devos-db";
import { or } from "drizzle-orm";
import type { BoardTaskApiRecord, TaskRepository } from "./task-service.types";

const HUMAN_ASSIGNEE_TYPE = "human";

export function createTaskRepository(db: ServerDatabase["db"]): TaskRepository {
	return {
		async listTasks() {
			const tasks = await db.select().from(boardTasksTable);
			return withAssignees(db, tasks);
		},
		async getTask(id) {
			const [task] = await db
				.select()
				.from(boardTasksTable)
				.where(eq(boardTasksTable.id, id));
			if (!task) {
				return null;
			}
			return withAssignee(db, task);
		},
		async getTaskActivity(id) {
			const [task] = await db
				.select()
				.from(boardTasksTable)
				.where(eq(boardTasksTable.id, id));
			if (!task) {
				return null;
			}
			const comments = await db
				.select()
				.from(taskCommentsTable)
				.where(eq(taskCommentsTable.taskId, id));
			const executionLogs = await db
				.select()
				.from(taskExecutionLogsTable)
				.where(eq(taskExecutionLogsTable.taskId, id));
			const logIds = executionLogs.map((log) => log.id);
			const executionSteps =
				logIds.length > 0
					? await db
							.select()
							.from(taskExecutionStepsTable)
							.where(inArray(taskExecutionStepsTable.executionLogId, logIds))
					: [];
			return { comments, executionLogs, executionSteps, task };
		},
		async projectExists(id) {
			const [project] = await db
				.select({ id: boardProjectsTable.id })
				.from(boardProjectsTable)
				.where(eq(boardProjectsTable.id, id));
			return Boolean(project);
		},
		async nextTaskKey(scope) {
			return generateBoardTaskKey(db, scope);
		},
		async createTask(input, assigneeId) {
			return db.transaction(async (tx) => {
				const [created] = await tx
					.insert(boardTasksTable)
					.values(input)
					.returning();
				await setTaskAssignee(tx, created.id, assigneeId);
				return { ...created, assigneeId: assigneeId ?? null };
			});
		},
		async updateTask(id, input: Partial<NewBoardTaskRow>, assigneeId) {
			return db.transaction(async (tx) => {
				const [updated] = await tx
					.update(boardTasksTable)
					.set(input)
					.where(eq(boardTasksTable.id, id))
					.returning();
				if (!updated) {
					return null;
				}
				await setTaskAssignee(tx, id, assigneeId);
				const currentAssigneeId =
					assigneeId === undefined
						? await readTaskAssignee(tx, id)
						: assigneeId;
				return { ...updated, assigneeId: currentAssigneeId ?? null };
			});
		},
		async deleteTask(id) {
			return db.transaction(async (tx) => {
				const existing = await readTaskForDelete(tx, id);
				if (!existing) {
					return null;
				}
				await tx
					.delete(taskAssigneesTable)
					.where(eq(taskAssigneesTable.taskId, id));
				await tx
					.delete(taskCommentsTable)
					.where(eq(taskCommentsTable.taskId, id));
				await tx.delete(taskTagsTable).where(eq(taskTagsTable.taskId, id));
				await tx
					.delete(taskPullRequestsTable)
					.where(eq(taskPullRequestsTable.taskId, id));
				await tx
					.delete(inboxMessagesTable)
					.where(eq(inboxMessagesTable.taskId, id));
				const executionLogs = await tx
					.select({ id: taskExecutionLogsTable.id })
					.from(taskExecutionLogsTable)
					.where(eq(taskExecutionLogsTable.taskId, id));
				const executionLogIds = executionLogs.map((log) => log.id);
				if (executionLogIds.length > 0) {
					await tx
						.delete(tokenUsageTable)
						.where(
							or(
								eq(tokenUsageTable.taskId, id),
								inArray(tokenUsageTable.taskExecutionLogId, executionLogIds),
							),
						);
					await tx
						.delete(taskExecutionStepsTable)
						.where(
							inArray(taskExecutionStepsTable.executionLogId, executionLogIds),
						);
				} else {
					await tx
						.delete(tokenUsageTable)
						.where(eq(tokenUsageTable.taskId, id));
				}
				await tx
					.delete(taskExecutionLogsTable)
					.where(eq(taskExecutionLogsTable.taskId, id));
				await tx.delete(boardTasksTable).where(eq(boardTasksTable.id, id));
				return existing;
			});
		},
		async addTaskComment(input) {
			await db.insert(taskCommentsTable).values(input);
		},
	};
}

type DbExecutor = Pick<ServerDatabase["db"], "delete" | "insert" | "select">;

async function withAssignees(
	db: DbExecutor,
	tasks: BoardTaskRow[],
): Promise<BoardTaskApiRecord[]> {
	if (tasks.length === 0) {
		return [];
	}
	const taskIds = tasks.map((task) => task.id);
	const assignees = await db
		.select()
		.from(taskAssigneesTable)
		.where(inArray(taskAssigneesTable.taskId, taskIds));
	const assigneeByTaskId = new Map<string, string>();
	for (const assignee of assignees) {
		if (assignee.assigneeType === HUMAN_ASSIGNEE_TYPE) {
			assigneeByTaskId.set(assignee.taskId, assignee.assigneeId);
		}
	}
	return tasks.map((task) => ({
		...task,
		assigneeId: assigneeByTaskId.get(task.id) ?? null,
	}));
}

async function withAssignee(
	db: DbExecutor,
	task: BoardTaskRow,
): Promise<BoardTaskApiRecord> {
	return {
		...task,
		assigneeId: await readTaskAssignee(db, task.id),
	};
}

async function readTaskForDelete(
	db: DbExecutor,
	taskId: string,
): Promise<BoardTaskApiRecord | null> {
	const [task] = await db
		.select()
		.from(boardTasksTable)
		.where(eq(boardTasksTable.id, taskId));
	return task ? withAssignee(db, task) : null;
}

async function readTaskAssignee(
	db: DbExecutor,
	taskId: string,
): Promise<string | null> {
	const [assignee] = await db
		.select()
		.from(taskAssigneesTable)
		.where(
			and(
				eq(taskAssigneesTable.taskId, taskId),
				eq(taskAssigneesTable.assigneeType, HUMAN_ASSIGNEE_TYPE),
			),
		);
	return assignee?.assigneeId ?? null;
}

async function setTaskAssignee(
	db: DbExecutor,
	taskId: string,
	assigneeId: string | null | undefined,
): Promise<void> {
	if (assigneeId === undefined) {
		return;
	}
	await db
		.delete(taskAssigneesTable)
		.where(
			and(
				eq(taskAssigneesTable.taskId, taskId),
				eq(taskAssigneesTable.assigneeType, HUMAN_ASSIGNEE_TYPE),
			),
		);
	if (!assigneeId) {
		return;
	}
	await db.insert(taskAssigneesTable).values({
		id: crypto.randomUUID(),
		taskId,
		assigneeId,
		assigneeType: HUMAN_ASSIGNEE_TYPE,
		createdAt: new Date().toISOString(),
	});
}
