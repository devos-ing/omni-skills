import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "devos-db";
import { eq } from "devos-db";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	initializeServerDatabase,
	projectBoardsTable,
} from "devos-db";
import { createBoardReadModels } from "../src/board-read-models";
import { createServerTestApp } from "./app-test-helpers";
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

describe("linear task reference fields", () => {
	it("creates, updates, lists, and reads Linear refs through task routes", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedProject(testDatabase.db);

		const createResponse = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 1",
					content: "Body",
					priority: 1,
					status: "planning",
					creatorId: "owner-1",
					linearIssueId: "lin-issue-1",
					linearIdentifier: "ROY-233",
					linearUrl: "https://linear.app/roy/issue/ROY-233/task",
				}),
			}),
		);
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as {
			id: string;
			linearIdentifier: string;
		};
		expect(created.linearIdentifier).toBe("ROY-233");

		const updateResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					linearIdentifier: "ROY-234",
					linearUrl: null,
				}),
			}),
		);
		expect(updateResponse.status).toBe(200);
		const updated = (await updateResponse.json()) as {
			linearIdentifier: string;
			linearUrl: string | null;
		};
		expect(updated.linearIdentifier).toBe("ROY-234");
		expect(updated.linearUrl).toBeNull();

		const listResponse = await app(
			new Request("http://localhost/api/tasks", { method: "GET" }),
		);
		const [listed] = (await listResponse.json()) as Array<{
			linearIssueId: string;
			linearIdentifier: string;
			linearUrl: string | null;
		}>;
		expect(listed).toMatchObject({
			linearIssueId: "lin-issue-1",
			linearIdentifier: "ROY-234",
			linearUrl: null,
		});

		const board = await createBoardReadModels(testDatabase.db).getProjectBoard(
			"owner-1",
			"project-1",
		);
		expect(board.tasks[0]).toMatchObject({
			linearIssueId: "lin-issue-1",
			linearIdentifier: "ROY-234",
			linearUrl: null,
		});
	});

	it("adds Linear ref columns when opening an existing board task table", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-linear-db-"));
		const databasePath = path.join(tempDir, "db");

		try {
			const oldClient = new PGlite(databasePath);
			await oldClient.exec(`
				CREATE TABLE board_tasks (
					id text PRIMARY KEY,
					project_id text NOT NULL,
					title text NOT NULL,
					content text NOT NULL,
					priority integer NOT NULL,
					status text NOT NULL,
					due_date timestamp,
					creator_id text NOT NULL,
					linked_pr text,
					created_at timestamp NOT NULL,
					updated_at timestamp NOT NULL
				);
			`);
			await oldClient.close();

			const migrated = await initializeServerDatabase(databasePath);
			await migrated.db.insert(boardTasksTable).values({
				id: "task-1",
				taskKey: "TASK-000001",
				projectId: "project-1",
				title: "Task",
				content: "Body",
				priority: 1,
				status: "planning",
				dueDate: null,
				creatorId: "owner-1",
				linkedPr: null,
				linearIssueId: "lin-issue-1",
				linearIdentifier: "ROY-233",
				linearUrl: "https://linear.app/roy/issue/ROY-233/task",
				createdAt: "2026-05-15 00:00:00",
				updatedAt: "2026-05-15 00:00:00",
			});

			const [task] = await migrated.db
				.select()
				.from(boardTasksTable)
				.where(eq(boardTasksTable.id, "task-1"));
			expect(task?.linearIdentifier).toBe("ROY-233");

			await migrated.close();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

function createApp(db: ServerDatabase["db"]) {
	return createServerTestApp(db);
}

async function seedProject(db: ServerDatabase["db"]) {
	await db.insert(projectBoardsTable).values({
		id: "board-1",
		name: "Board",
		description: "Test board",
		ownerId: "owner-1",
		createdAt: "2026-05-15T00:00:00.000Z",
		updatedAt: "2026-05-15T00:00:00.000Z",
	});
	await db.insert(boardProjectsTable).values({
		id: "project-1",
		boardId: "board-1",
		externalProjectId: null,
		name: "Project",
		description: null,
		ownerId: "owner-1",
		createdAt: "2026-05-15T00:00:00.000Z",
		updatedAt: "2026-05-15T00:00:00.000Z",
	});
}
