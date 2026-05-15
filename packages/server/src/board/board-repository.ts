import { and, asc, eq, inArray } from "drizzle-orm";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
} from "../db";
import {
	type BoardRepository,
	type BoardStatusColumn,
	type BoardTaskSummary,
	REQUIRED_BOARD_STATUSES,
	type WorkspaceProjectBoard,
	type WorkspaceProjectSummary,
} from "./board.types";

export function createBoardRepository(
	db: ServerDatabase["db"],
): BoardRepository {
	return {
		async listWorkspaceProjects(workspaceId) {
			const rows = await db
				.select({
					id: boardProjectsTable.id,
					boardId: boardProjectsTable.boardId,
					workspaceId: boardProjectsTable.ownerId,
					externalProjectId: boardProjectsTable.externalProjectId,
					name: boardProjectsTable.name,
					description: boardProjectsTable.description,
					createdAt: boardProjectsTable.createdAt,
					updatedAt: boardProjectsTable.updatedAt,
				})
				.from(boardProjectsTable)
				.where(eq(boardProjectsTable.ownerId, workspaceId))
				.orderBy(asc(boardProjectsTable.createdAt), asc(boardProjectsTable.id));

			return rows satisfies WorkspaceProjectSummary[];
		},
		async getWorkspaceProjectBoard(workspaceId, projectId) {
			const projectRows = await db
				.select({
					id: boardProjectsTable.id,
					boardId: boardProjectsTable.boardId,
					workspaceId: boardProjectsTable.ownerId,
					externalProjectId: boardProjectsTable.externalProjectId,
					name: boardProjectsTable.name,
					description: boardProjectsTable.description,
					createdAt: boardProjectsTable.createdAt,
					updatedAt: boardProjectsTable.updatedAt,
				})
				.from(boardProjectsTable)
				.innerJoin(
					projectBoardsTable,
					eq(projectBoardsTable.id, boardProjectsTable.boardId),
				)
				.where(
					and(
						eq(boardProjectsTable.id, projectId),
						eq(boardProjectsTable.ownerId, workspaceId),
						eq(projectBoardsTable.ownerId, workspaceId),
					),
				)
				.limit(1);
			const project = projectRows[0];
			if (!project) {
				return null;
			}

			const taskRows = await db
				.select({
					id: boardTasksTable.id,
					taskKey: boardTasksTable.taskKey,
					projectId: boardTasksTable.projectId,
					title: boardTasksTable.title,
					content: boardTasksTable.content,
					priority: boardTasksTable.priority,
					status: boardTasksTable.status,
					dueDate: boardTasksTable.dueDate,
					creatorId: boardTasksTable.creatorId,
					linkedPr: boardTasksTable.linkedPr,
					linearIssueId: boardTasksTable.linearIssueId,
					linearIdentifier: boardTasksTable.linearIdentifier,
					linearUrl: boardTasksTable.linearUrl,
					createdAt: boardTasksTable.createdAt,
					updatedAt: boardTasksTable.updatedAt,
				})
				.from(boardTasksTable)
				.where(
					and(
						eq(boardTasksTable.projectId, project.id),
						inArray(boardTasksTable.status, [...REQUIRED_BOARD_STATUSES]),
					),
				)
				.orderBy(asc(boardTasksTable.createdAt), asc(boardTasksTable.id));

			return {
				project,
				statusColumns: buildStatusColumns(taskRows),
			} satisfies WorkspaceProjectBoard;
		},
	};
}

function buildStatusColumns(tasks: BoardTaskSummary[]): BoardStatusColumn[] {
	const byStatus = new Map<string, BoardTaskSummary[]>();
	for (const task of tasks) {
		const items = byStatus.get(task.status) ?? [];
		items.push(task);
		byStatus.set(task.status, items);
	}

	return REQUIRED_BOARD_STATUSES.map((status) => ({
		status,
		tasks: byStatus.get(status) ?? [],
	}));
}
