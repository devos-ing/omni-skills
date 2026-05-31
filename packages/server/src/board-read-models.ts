import { and, eq, inArray } from "devos-db";
import type { ServerDb } from "devos-db";
import {
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
	taskAssigneesTable,
} from "devos-db/schema";
import type {
	BoardReadModels,
	ProjectBoardRecord,
	ProjectBoardTaskRecord,
	WorkspaceProjectRecord,
} from "./types/app.types";

const LEGACY_PR_CREATED_STATUS = "pr_created";
const LEGACY_PLANNING_STATUS = "planning";
const LEGACY_PLAN_STATUS = "todo";
const LEGACY_IN_PROGRESS_STATUS = "implementing";
const LEGACY_REVIEW_STATUSES = ["reviewing", "testing"] as const;

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
				emoji: row.emoji,
				description: row.description,
				repoOwner: row.repoOwner,
				repoName: row.repoName,
				baseBranch: row.baseBranch,
				localFolder: row.localFolder,
				lead: row.lead,
				category: row.category,
				priority: row.priority,
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
			const assigneeByTaskId = await readHumanAssignees(
				db,
				tasks.map((task) => task.id),
			);

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
					emoji: project.emoji,
					description: project.description,
					repoOwner: project.repoOwner,
					repoName: project.repoName,
					baseBranch: project.baseBranch,
					localFolder: project.localFolder,
					lead: project.lead,
					category: project.category,
					priority: project.priority,
					ownerId: project.ownerId,
					createdAt: project.createdAt,
					updatedAt: project.updatedAt,
				})),
				tasks: tasks.map(
					(task): ProjectBoardTaskRecord => ({
						id: task.id,
						taskKey: task.taskKey,
						projectId: task.projectId,
						title: task.title,
						content: task.content,
						priority: task.priority,
						status: normalizeBoardStatus(task.status),
						dueDate: task.dueDate,
						creatorId: task.creatorId,
						assigneeId: assigneeByTaskId.get(task.id) ?? null,
						linkedPr: task.linkedPr,
						createdAt: task.createdAt,
						updatedAt: task.updatedAt,
					}),
				),
			};
		},
	};
}

function normalizeBoardStatus(status: string): string {
	if (status === LEGACY_PLANNING_STATUS) {
		return "plan";
	}
	if (status === LEGACY_PLAN_STATUS) {
		return "plan";
	}
	if (status === LEGACY_IN_PROGRESS_STATUS) {
		return "in_progress";
	}
	return status === LEGACY_PR_CREATED_STATUS ||
		(LEGACY_REVIEW_STATUSES as readonly string[]).includes(status)
		? "in_review"
		: status;
}

async function readHumanAssignees(
	db: ServerDb,
	taskIds: string[],
): Promise<Map<string, string>> {
	if (taskIds.length === 0) {
		return new Map();
	}
	const assignees = await db
		.select()
		.from(taskAssigneesTable)
		.where(inArray(taskAssigneesTable.taskId, taskIds));
	return new Map(
		assignees
			.filter((assignee) => assignee.assigneeType === "human")
			.map((assignee) => [assignee.taskId, assignee.assigneeId]),
	);
}
