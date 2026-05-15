import { createHandleRequest } from "../src/app";
import type { AppDeps } from "../src/app.types";
import {
	type ServerDatabase,
	boardProjectsTable,
	projectBoardsTable,
} from "../src/db";

export function createTaskChatCreateTestApp(
	db: ServerDatabase["db"],
	execute: AppDeps["cliExecutor"]["execute"],
) {
	return createHandleRequest({
		cliExecutor: {
			execute,
			executeStream: async (request) => execute(request),
			getHistory: () => [],
		},
		db,
	});
}

export async function seedTaskChatProject(
	db: ServerDatabase["db"],
	projectId: string,
): Promise<void> {
	await db.insert(projectBoardsTable).values({
		id: "board-1",
		name: "Board",
		description: "Test board",
		ownerId: "owner-1",
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
	await db.insert(boardProjectsTable).values({
		id: projectId,
		boardId: "board-1",
		externalProjectId: null,
		name: "Project",
		description: null,
		ownerId: "owner-1",
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
}

export function createdTaskChatIntake(
	overrides: Partial<ReturnType<typeof createdTaskChatBoardTask>> = {},
) {
	return {
		status: "created",
		task: createdTaskChatBoardTask(overrides),
	};
}

export function createdTaskChatBoardTask(overrides = {}) {
	return {
		id: "task-1",
		taskKey: "TASK-000001",
		projectId: "project-1",
		title: "Compose task creation",
		content: "Create both task records.",
		priority: 1,
		status: "planning",
		dueDate: null,
		creatorId: "owner-1",
		linkedPr: null,
		linearIssueId: null,
		linearIdentifier: null,
		linearUrl: null,
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
		...overrides,
	};
}
