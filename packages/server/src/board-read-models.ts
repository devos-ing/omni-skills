import { and, eq, inArray } from "drizzle-orm";
import type {
	BoardReadModels,
	ProjectBoardRecord,
	ProjectBoardTaskRecord,
	WorkspaceProjectRecord,
} from "./app.types";
import type { ServerDatabase } from "./db/database.types";
import {
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
} from "./db/schema";

type ServerDb = ServerDatabase["db"];

export function createBoardReadModels(db: ServerDb): BoardReadModels {
	return {
		async listWorkspaceProjects(
			workspaceId: string,
		): Promise<WorkspaceProjectRecord[]> {
			const rows = await db
				.select()
				.from(boardProjectsTable)
				.where(eq(boardProjectsTable.ownerId, workspaceId))
				.orderBy(boardProjectsTable.id);
			return rows.map((row) => ({
				id: row.id,
				boardId: row.boardId,
				externalProjectId: row.externalProjectId,
				name: row.name,
				description: row.description,
				ownerId: row.ownerId,
				createdAt: row.createdAt,
				updatedAt: row.updatedAt,
			}));
		},
		async getProjectBoard(
			workspaceId: string,
			projectId: string,
		): Promise<ProjectBoardRecord> {
			const [selectedProject] = await db
				.select()
				.from(boardProjectsTable)
				.where(
					and(
						eq(boardProjectsTable.ownerId, workspaceId),
						eq(boardProjectsTable.id, projectId),
					),
				);
			if (!selectedProject) {
				throw new Error(
					`Project '${projectId}' for workspace '${workspaceId}' not found`,
				);
			}

			const [board] = await db
				.select()
				.from(projectBoardsTable)
				.where(eq(projectBoardsTable.id, selectedProject.boardId));
			if (!board) {
				throw new Error(
					`Board '${selectedProject.boardId}' for project '${projectId}' not found`,
				);
			}

			const projects = await db
				.select()
				.from(boardProjectsTable)
				.where(
					and(
						eq(boardProjectsTable.ownerId, workspaceId),
						eq(boardProjectsTable.boardId, board.id),
					),
				)
				.orderBy(boardProjectsTable.id);

			const projectIds = projects.map((project) => project.id);
			const tasks =
				projectIds.length === 0
					? []
					: await db
							.select()
							.from(boardTasksTable)
							.where(inArray(boardTasksTable.projectId, projectIds))
							.orderBy(boardTasksTable.id);

			return {
				id: board.id,
				name: board.name,
				description: board.description,
				ownerId: board.ownerId,
				createdAt: board.createdAt,
				updatedAt: board.updatedAt,
				projects: projects.map((project) => ({
					id: project.id,
					boardId: project.boardId,
					externalProjectId: project.externalProjectId,
					name: project.name,
					description: project.description,
					ownerId: project.ownerId,
					createdAt: project.createdAt,
					updatedAt: project.updatedAt,
				})),
				tasks: tasks.map(
					(task): ProjectBoardTaskRecord => ({
						id: task.id,
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
					}),
				),
			};
		},
	};
}
