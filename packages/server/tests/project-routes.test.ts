import { afterEach, describe, expect, it } from "bun:test";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
} from "devos-db";
import { createHandleRequest } from "../src/app";
import type {
	RealtimeEventPayload,
	RealtimeEventPublisher,
} from "../src/realtime";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("project routes", () => {
	it("supports project CRUD/list", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedBoard(testDatabase.db, "board-1");

		const createResponse = await app(
			new Request("http://localhost/api/projects", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					boardId: "board-1",
					name: "Core",
					ownerId: "owner-1",
					emoji: "🧭",
					description: "desc",
					repoOwner: "octo",
					repoName: "core",
					baseBranch: "main",
					localFolder: "/tmp/core",
					lead: "Roy",
					category: "platform",
					priority: 1,
				}),
			}),
		);
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as {
			id: string;
			name: string;
			emoji: string | null;
			repoOwner: string | null;
			repoName: string | null;
			baseBranch: string | null;
			localFolder: string | null;
			lead: string | null;
			category: string | null;
			priority: number | null;
		};
		expect(created.name).toBe("Core");
		expect(created.emoji).toBe("🧭");
		expect(created.repoOwner).toBe("octo");
		expect(created.repoName).toBe("core");
		expect(created.baseBranch).toBe("main");
		expect(created.localFolder).toBe("/tmp/core");
		expect(created.lead).toBe("Roy");
		expect(created.category).toBe("platform");
		expect(created.priority).toBe(1);

		const listResponse = await app(
			new Request("http://localhost/api/projects", { method: "GET" }),
		);
		expect(listResponse.status).toBe(200);
		expect((await listResponse.json()) as unknown[]).toHaveLength(1);

		const readResponse = await app(
			new Request(`http://localhost/api/projects/${created.id}`, {
				method: "GET",
			}),
		);
		expect(readResponse.status).toBe(200);

		const updateResponse = await app(
			new Request(`http://localhost/api/projects/${created.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Core Updated", priority: 2 }),
			}),
		);
		expect(updateResponse.status).toBe(200);
		const updated = (await updateResponse.json()) as {
			name: string;
			priority: number | null;
		};
		expect(updated.name).toBe("Core Updated");
		expect(updated.priority).toBe(2);

		const deleteResponse = await app(
			new Request(`http://localhost/api/projects/${created.id}`, {
				method: "DELETE",
			}),
		);
		expect(deleteResponse.status).toBe(200);
	});

	it("returns consistent errors for invalid payloads, missing records, and FK failures", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedBoard(testDatabase.db, "board-1");

		const malformed = await app(
			new Request("http://localhost/api/projects", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: "{invalid",
			}),
		);
		expect(malformed.status).toBe(400);

		const invalid = await app(
			new Request("http://localhost/api/projects", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ boardId: "board-1", ownerId: "owner-1" }),
			}),
		);
		expect(invalid.status).toBe(400);

		const fkFailure = await app(
			new Request("http://localhost/api/projects", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					boardId: "missing-board",
					name: "Core",
					ownerId: "owner-1",
				}),
			}),
		);
		expect(fkFailure.status).toBe(400);
		expect((await fkFailure.json()) as { error: string }).toEqual({
			error: "Foreign key constraint failed",
		});

		const notFoundRead = await app(
			new Request("http://localhost/api/projects/missing", { method: "GET" }),
		);
		expect(notFoundRead.status).toBe(404);

		const notFoundUpdate = await app(
			new Request("http://localhost/api/projects/missing", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "x" }),
			}),
		);
		expect(notFoundUpdate.status).toBe(404);

		const notFoundDelete = await app(
			new Request("http://localhost/api/projects/missing", {
				method: "DELETE",
			}),
		);
		expect(notFoundDelete.status).toBe(404);
	});

	it("returns JSON not-found errors for missing IDs and FK-protected deletes", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedBoard(testDatabase.db, "board-1");

		const [project] = await testDatabase.db
			.insert(boardProjectsTable)
			.values({
				id: "project-1",
				boardId: "board-1",
				externalProjectId: null,
				name: "Project",
				description: null,
				ownerId: "owner-1",
				createdAt: "2026-05-13T00:00:00.000Z",
				updatedAt: "2026-05-13T00:00:00.000Z",
			})
			.returning();
		await testDatabase.db.insert(boardTasksTable).values({
			id: "task-1",
			taskKey: "TASK-000001",
			projectId: project.id,
			title: "Task",
			content: "Body",
			priority: 1,
			status: "open",
			creatorId: "owner-1",
			dueDate: null,
			linkedPr: null,
			createdAt: "2026-05-13T00:00:00.000Z",
			updatedAt: "2026-05-13T00:00:00.000Z",
		});

		for (const method of ["GET", "PATCH", "DELETE"] as const) {
			const response = await app(
				new Request("http://localhost/api/projects/", {
					method,
					headers: { "content-type": "application/json" },
					body: method === "PATCH" ? JSON.stringify({ name: "x" }) : undefined,
				}),
			);
			expect(response.status).toBe(404);
			expect((await response.json()) as { error: string }).toEqual({
				error: "Project not found",
			});
		}

		const fkDelete = await app(
			new Request(`http://localhost/api/projects/${project.id}`, {
				method: "DELETE",
			}),
		);
		expect(fkDelete.status).toBe(400);
		expect((await fkDelete.json()) as { error: string }).toEqual({
			error: "Foreign key constraint failed",
		});
	});

	it("publishes normalized realtime project events after successful mutations", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const app = createApp(testDatabase.db, {
			publish: (event) => events.push(event),
		});
		await seedBoard(testDatabase.db, "board-1");

		const invalid = await app(
			new Request("http://localhost/api/projects", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ boardId: "board-1", ownerId: "owner-1" }),
			}),
		);
		expect(invalid.status).toBe(400);
		expect(events).toEqual([]);

		const createResponse = await app(
			new Request("http://localhost/api/projects", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					boardId: "board-1",
					name: "Core",
					ownerId: "owner-1",
				}),
			}),
		);
		const created = (await createResponse.json()) as { id: string };

		await app(
			new Request(`http://localhost/api/projects/${created.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ name: "Core Updated" }),
			}),
		);
		await app(
			new Request(`http://localhost/api/projects/${created.id}`, {
				method: "DELETE",
			}),
		);

		expect(events.map((event) => event.type)).toEqual([
			"project.created",
			"project.updated",
			"project.deleted",
		]);
		expect(events[0]).toMatchObject({
			type: "project.created",
			project: { id: created.id, workspaceId: "owner-1" },
		});
	});
});

function createApp(
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

async function seedBoard(db: ServerDatabase["db"], id: string) {
	await db.insert(projectBoardsTable).values({
		id,
		name: "Board",
		description: "Test board",
		ownerId: "owner-1",
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
}
