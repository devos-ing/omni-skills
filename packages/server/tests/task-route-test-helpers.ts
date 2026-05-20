import {
	type ServerDatabase,
	boardProjectsTable,
	projectBoardsTable,
} from "devos-db";
import { createHandleRequest } from "../src/app";
import type { RealtimeEventPublisher } from "../src/realtime";

export function createTaskRouteTestApp(
	db: ServerDatabase["db"],
	realtimeEvents?: RealtimeEventPublisher,
) {
	return createHandleRequest({
		cliExecutor: {
			execute: async (request) => ({ status: "succeeded", request }),
			executeStream: async (request) => ({ status: "succeeded", request }),
			getHistory: () => [],
		},
		db,
		realtimeEvents,
	});
}

export async function seedTaskRouteProject(
	db: ServerDatabase["db"],
	projectId = "project-1",
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
