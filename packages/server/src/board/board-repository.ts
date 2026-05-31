import { and, asc, eq, inArray } from "devos-db";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
	taskAssigneesTable,
} from "devos-db";
import {
	type BoardRepository,
	type BoardStatusColumn,
	type BoardTaskSummary,
	REQUIRED_BOARD_STATUSES,
	type WorkspaceProjectBoard,
	type WorkspaceProjectSummary,
} from "./types/board.types";

const LEGACY_PR_CREATED_STATUS = "pr_created";
const LEGACY_PLANNING_STATUS = "planning";
const LEGACY_PLAN_STATUS = "todo";
const LEGACY_IN_PROGRESS_STATUS = "implementing";
const LEGACY_REVIEW_STATUSES = ["reviewing", "testing"] as const;
const BOARD_STATUS_QUERY_VALUES = [
	...REQUIRED_BOARD_STATUSES,
	LEGACY_PLANNING_STATUS,
	LEGACY_PLAN_STATUS,
	LEGACY_IN_PROGRESS_STATUS,
	LEGACY_PR_CREATED_STATUS,
	...LEGACY_REVIEW_STATUSES,
];

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
					emoji: boardProjectsTable.emoji,
					description: boardProjectsTable.description,
					repoOwner: boardProjectsTable.repoOwner,
					repoName: boardProjectsTable.repoName,
					baseBranch: boardProjectsTable.baseBranch,
					localFolder: boardProjectsTable.localFolder,
					lead: boardProjectsTable.lead,
					category: boardProjectsTable.category,
					priority: boardProjectsTable.priority,
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
					emoji: boardProjectsTable.emoji,
					description: boardProjectsTable.description,
					repoOwner: boardProjectsTable.repoOwner,
					repoName: boardProjectsTable.repoName,
					baseBranch: boardProjectsTable.baseBranch,
					localFolder: boardProjectsTable.localFolder,
					lead: boardProjectsTable.lead,
					category: boardProjectsTable.category,
					priority: boardProjectsTable.priority,
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
					createdAt: boardTasksTable.createdAt,
					updatedAt: boardTasksTable.updatedAt,
				})
				.from(boardTasksTable)
				.where(
					and(
						eq(boardTasksTable.projectId, project.id),
						inArray(boardTasksTable.status, BOARD_STATUS_QUERY_VALUES),
					),
				)
				.orderBy(asc(boardTasksTable.createdAt), asc(boardTasksTable.id));

			const tasks = await attachAssignees(db, taskRows);
			return {
				project,
				statusColumns: buildStatusColumns(tasks),
			} satisfies WorkspaceProjectBoard;
		},
	};
}

async function attachAssignees(
	db: ServerDatabase["db"],
	tasks: Omit<BoardTaskSummary, "assigneeId">[],
): Promise<BoardTaskSummary[]> {
	if (tasks.length === 0) {
		return [];
	}
	const assignees = await db
		.select()
		.from(taskAssigneesTable)
		.where(
			inArray(
				taskAssigneesTable.taskId,
				tasks.map((task) => task.id),
			),
		);
	const assigneeByTaskId = new Map(
		assignees
			.filter((assignee) => assignee.assigneeType === "human")
			.map((assignee) => [assignee.taskId, assignee.assigneeId]),
	);
	return tasks.map((task) => ({
		...task,
		assigneeId: assigneeByTaskId.get(task.id) ?? null,
	}));
}

function buildStatusColumns(tasks: BoardTaskSummary[]): BoardStatusColumn[] {
	const byStatus = new Map<string, BoardTaskSummary[]>();
	for (const task of tasks) {
		const status = normalizeBoardStatus(task.status);
		const items = byStatus.get(status) ?? [];
		items.push({ ...task, status });
		byStatus.set(status, items);
	}

	return REQUIRED_BOARD_STATUSES.map((status) => ({
		status,
		tasks: byStatus.get(status) ?? [],
	}));
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
