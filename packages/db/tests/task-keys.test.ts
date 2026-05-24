import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	generateBoardTaskKey,
	initializeServerDatabase,
	projectBoardsTable,
} from "../src";

const NOW = "2026-05-24 00:00:00";
const EMBEDDED_POSTGRES_TEST_TIMEOUT_MS = 20_000;

let testDatabase:
	| {
			database: ServerDatabase;
			db: ServerDatabase["db"];
			tempDir: string;
	  }
	| undefined;

afterEach(async () => {
	if (!testDatabase) {
		return;
	}
	await testDatabase.database.close();
	await rm(testDatabase.tempDir, { recursive: true, force: true });
	testDatabase = undefined;
});

describe("generateBoardTaskKey", () => {
	it(
		"generates per-project keys from matching new-format task keys",
		async () => {
			testDatabase = await createTestDatabase();
			const { db } = testDatabase;
			await seedProject(db, "project-1");
			await seedProject(db, "project-2");
			await insertTask(db, {
				id: "legacy-task",
				taskKey: "TASK-000999",
				projectId: "project-1",
				creatorId: "owner-1",
			});
			await insertTask(db, {
				id: "project-1-first",
				taskKey: "TASK(project-1)-1",
				projectId: "project-1",
				creatorId: "owner-1",
			});
			await insertTask(db, {
				id: "project-1-latest",
				taskKey: "TASK(project-1)-13",
				projectId: "project-1",
				creatorId: "owner-1",
			});
			await insertTask(db, {
				id: "project-1-padded",
				taskKey: "TASK(project-1)-001",
				projectId: "project-1",
				creatorId: "owner-1",
			});
			await insertTask(db, {
				id: "project-2-task",
				taskKey: "TASK(project-2)-4",
				projectId: "project-2",
				creatorId: "owner-1",
			});

			await expect(
				generateBoardTaskKey(db, {
					projectId: "project-1",
					creatorId: "owner-1",
				}),
			).resolves.toBe("TASK(project-1)-14");
			await expect(
				generateBoardTaskKey(db, {
					projectId: "project-2",
					creatorId: "owner-1",
				}),
			).resolves.toBe("TASK(project-2)-5");
		},
		EMBEDDED_POSTGRES_TEST_TIMEOUT_MS,
	);

	it(
		"uses creator id as the workspace slug for projectless tasks",
		async () => {
			testDatabase = await createTestDatabase();
			const { db } = testDatabase;
			await insertTask(db, {
				id: "legacy-task",
				taskKey: "TASK-000001",
				projectId: null,
				creatorId: "owner-1",
			});
			await insertTask(db, {
				id: "owner-1-task",
				taskKey: "TASK(owner-1)-3",
				projectId: null,
				creatorId: "owner-1",
			});
			await insertTask(db, {
				id: "owner-2-task",
				taskKey: "TASK(owner-2)-7",
				projectId: null,
				creatorId: "owner-2",
			});

			await expect(
				generateBoardTaskKey(db, { projectId: null, creatorId: "owner-1" }),
			).resolves.toBe("TASK(owner-1)-4");
			await expect(
				generateBoardTaskKey(db, { projectId: null, creatorId: "owner-3" }),
			).resolves.toBe("TASK(owner-3)-1");
		},
		EMBEDDED_POSTGRES_TEST_TIMEOUT_MS,
	);
});

async function createTestDatabase() {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-task-key-test-"));
	const database = await initializeServerDatabase(
		path.join(tempDir, "server-db"),
		{ port: await createDatabasePort() },
	);
	return { database, db: database.db, tempDir };
}

async function seedProject(
	db: ServerDatabase["db"],
	projectId: string,
): Promise<void> {
	await db
		.insert(projectBoardsTable)
		.values({
			id: "board-1",
			name: "Board",
			description: "Test board",
			ownerId: "owner-1",
			createdAt: NOW,
			updatedAt: NOW,
		})
		.onConflictDoNothing();
	await db.insert(boardProjectsTable).values({
		id: projectId,
		boardId: "board-1",
		externalProjectId: null,
		name: projectId,
		description: null,
		ownerId: "owner-1",
		createdAt: NOW,
		updatedAt: NOW,
	});
}

async function insertTask(
	db: ServerDatabase["db"],
	input: {
		id: string;
		taskKey: string;
		projectId: string | null;
		creatorId: string;
	},
): Promise<void> {
	await db.insert(boardTasksTable).values({
		id: input.id,
		taskKey: input.taskKey,
		projectId: input.projectId,
		title: input.id,
		content: "Task content",
		priority: 1,
		status: "todo",
		dueDate: null,
		creatorId: input.creatorId,
		linkedPr: null,
		createdAt: NOW,
		updatedAt: NOW,
	});
}

async function createDatabasePort(): Promise<number> {
	return new Promise((resolve, reject) => {
		const server = createServer();
		server.once("error", reject);
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			server.close(() => {
				if (typeof address === "object" && address?.port) {
					resolve(address.port);
					return;
				}
				reject(new Error("Failed to allocate test database port"));
			});
		});
	});
}
