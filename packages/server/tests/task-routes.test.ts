import { afterEach, describe, expect, it } from "bun:test";
import { createHandleRequest } from "../src/app";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
	taskTagsTable,
} from "../src/db";
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

describe("task routes", () => {
	it("supports task CRUD/list", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedProject(testDatabase.db, "project-1");

		const createResponse = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 1",
					content: "Body",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as {
			id: string;
			title: string;
		};
		expect(created.title).toBe("Task 1");

		const unassignedResponse = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: "Unassigned task",
					content: "Assign this later",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(unassignedResponse.status).toBe(201);
		expect(
			((await unassignedResponse.json()) as { projectId: string | null })
				.projectId,
		).toBeNull();

		const listResponse = await app(
			new Request("http://localhost/api/tasks", { method: "GET" }),
		);
		expect(listResponse.status).toBe(200);
		expect((await listResponse.json()) as unknown[]).toHaveLength(2);

		const readResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "GET",
			}),
		);
		expect(readResponse.status).toBe(200);

		const updateResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status: "done", priority: 2 }),
			}),
		);
		expect(updateResponse.status).toBe(200);
		expect(((await updateResponse.json()) as { status: string }).status).toBe(
			"done",
		);

		const deleteResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "DELETE",
			}),
		);
		expect(deleteResponse.status).toBe(200);
	});

	it("returns consistent errors for invalid payloads, missing records, and FK failures", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedProject(testDatabase.db, "project-1");

		const invalid = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 1",
					content: "Body",
					priority: "high",
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(invalid.status).toBe(400);

		const fkFailure = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "missing-project",
					title: "Task 1",
					content: "Body",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(fkFailure.status).toBe(400);
		expect((await fkFailure.json()) as { error: string }).toEqual({
			error: "Foreign key constraint failed",
		});

		const invalidDate = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 2",
					content: "Body",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
					dueDate: "not-a-date",
				}),
			}),
		);
		expect(invalidDate.status).toBe(400);

		const notFoundRead = await app(
			new Request("http://localhost/api/tasks/missing", { method: "GET" }),
		);
		expect(notFoundRead.status).toBe(404);

		const notFoundUpdate = await app(
			new Request("http://localhost/api/tasks/missing", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status: "done" }),
			}),
		);
		expect(notFoundUpdate.status).toBe(404);

		const notFoundDelete = await app(
			new Request("http://localhost/api/tasks/missing", { method: "DELETE" }),
		);
		expect(notFoundDelete.status).toBe(404);
	});

	it("returns JSON not-found errors for missing IDs and FK-protected deletes", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedProject(testDatabase.db, "project-1");

		const [task] = await testDatabase.db
			.insert(boardTasksTable)
			.values({
				id: "task-1",
				taskKey: "TASK-000001",
				projectId: "project-1",
				title: "Task 1",
				content: "Body",
				priority: 1,
				status: "open",
				creatorId: "owner-1",
				dueDate: null,
				linkedPr: null,
				createdAt: "2026-05-13T00:00:00.000Z",
				updatedAt: "2026-05-13T00:00:00.000Z",
			})
			.returning();
		await testDatabase.db.insert(taskTagsTable).values({
			id: "tag-1",
			taskId: task.id,
			tag: "bug",
		});

		for (const method of ["GET", "PATCH", "DELETE"] as const) {
			const response = await app(
				new Request("http://localhost/api/tasks/", {
					method,
					headers: { "content-type": "application/json" },
					body:
						method === "PATCH"
							? JSON.stringify({ status: "done", priority: 2 })
							: undefined,
				}),
			);
			expect(response.status).toBe(404);
			expect((await response.json()) as { error: string }).toEqual({
				error: "Task not found",
			});
		}

		const fkDelete = await app(
			new Request(`http://localhost/api/tasks/${task.id}`, {
				method: "DELETE",
			}),
		);
		expect(fkDelete.status).toBe(400);
		expect((await fkDelete.json()) as { error: string }).toEqual({
			error: "Foreign key constraint failed",
		});
	});
});

function createApp(db: ServerDatabase["db"]) {
	return createHandleRequest({
		cliExecutor: {
			execute: async (request) => ({ status: "succeeded", request }),
			executeStream: async (request) => ({ status: "succeeded", request }),
			getHistory: () => [],
		},
		db,
	});
}

async function seedProject(db: ServerDatabase["db"], projectId: string) {
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
