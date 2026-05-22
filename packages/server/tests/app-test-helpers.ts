import type { ServerDatabase } from "devos-db";
import { boardProjectsTable, projectBoardsTable } from "devos-db";
import { createHandleRequest } from "../src/app";
import type { AppDeps, RouteHandler } from "../src/app.types";

export function createJsonRequest(
	method: string,
	pathname: string,
	body: unknown,
): Request {
	return new Request(`http://localhost${pathname}`, {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}

export function createServerTestApp(
	db: ServerDatabase["db"],
	overrides: Partial<AppDeps> = {},
): RouteHandler {
	return createHandleRequest({
		cliExecutor: {
			execute: async (request) => ({ status: "succeeded", request }),
			executeStream: async (request) => ({ status: "succeeded", request }),
			getHistory: () => [],
		},
		db,
		...overrides,
	});
}

export async function seedServerTestProject(
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
