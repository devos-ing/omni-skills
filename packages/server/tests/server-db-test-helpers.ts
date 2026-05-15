import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	type ServerDatabase,
	agentsTable,
	boardProjectsTable,
	boardTasksTable,
	commandHistoryTable,
	initializeServerDatabase,
	jobsTable,
	projectBoardsTable,
	skillsTable,
	tokenUsageTable,
} from "../src/db";

export interface TestDatabase {
	database: ServerDatabase;
	db: ServerDatabase["db"];
	path: string;
	cleanup(): Promise<void>;
}

export type DrizzleServerTestDatabase = TestDatabase;

export async function createServerTestDatabase(): Promise<TestDatabase> {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-server-db-"));
	const dbPath = path.join(tempDir, "server.pgdata");
	const database = await initializeServerDatabase(dbPath);

	return {
		database,
		db: database.db,
		path: dbPath,
		async cleanup() {
			await database.close();
			await rm(tempDir, { recursive: true, force: true });
		},
	};
}

export const createDrizzleServerTestDatabase = createServerTestDatabase;

export async function seedServerTestDatabase(
	database: ServerDatabase,
): Promise<void> {
	await database.db.insert(tokenUsageTable).values({
		id: "tu-1",
		runId: "run-1",
		stage: "planning",
		inputTokens: 10,
		outputTokens: 5,
		totalTokens: 15,
		recordedAt: "2026-05-12T00:00:00.000Z",
	});
	await database.db.insert(jobsTable).values({
		id: "job-1",
		projectId: "default",
		issueKey: "ROY-129",
		stage: "implementing",
		status: "in_progress",
		createdAt: "2026-05-12T00:01:00.000Z",
	});
	await database.db.insert(agentsTable).values({
		id: "agent-1",
		name: "codex-main",
		description: "Primary coding agent",
		logo: "https://example.com/codex.svg",
		runtime: "codex",
		backend: "codex",
		model: "gpt-5",
		concurrency: 2,
		owner: "owner-1",
		createdAt: "2026-05-12T00:02:00.000Z",
		updatedAt: "2026-05-12T00:03:00.000Z",
		skills: JSON.stringify(["adhd-plan", "adhd-implement"]),
		recentWork: JSON.stringify(["ROY-228"]),
		activity: JSON.stringify(["planning"]),
		instructions: "Keep responses implementation-focused.",
	});
	await database.db.insert(skillsTable).values({
		id: "skill-1",
		name: "backend-standard",
		description: "Backend implementation guidance",
		source: "folder",
		updatedAt: "2026-05-12T00:03:00.000Z",
	});
	await database.db.insert(commandHistoryTable).values({
		id: "cmd-1",
		command: "bun test",
		exitCode: 0,
		executedAt: "2026-05-12T00:04:00.000Z",
	});
	await database.db.insert(projectBoardsTable).values({
		id: "board-1",
		name: "Workspace Board",
		description: "Primary board for workspace planning",
		ownerId: "owner-1",
		createdAt: "2026-05-12T00:05:00.000Z",
		updatedAt: "2026-05-12T00:05:00.000Z",
	});
	await database.db.insert(boardProjectsTable).values({
		id: "project-1",
		boardId: "board-1",
		externalProjectId: "ext-project-42",
		name: "API Hardening",
		description: "Contract and route updates",
		ownerId: "owner-1",
		createdAt: "2026-05-12T00:06:00.000Z",
		updatedAt: "2026-05-12T00:06:00.000Z",
	});
	await database.db.insert(boardTasksTable).values({
		id: "task-1",
		projectId: "project-1",
		title: "Document board APIs",
		content: "Update OpenAPI and tests for board endpoints",
		priority: 2,
		status: "todo",
		dueDate: null,
		creatorId: "owner-1",
		linkedPr: null,
		createdAt: "2026-05-12T00:07:00.000Z",
		updatedAt: "2026-05-12T00:07:00.000Z",
	});
}
