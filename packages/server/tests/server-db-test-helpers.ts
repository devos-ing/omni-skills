import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
	type ServerDatabase,
	agentsTable,
	commandHistoryTable,
	initializeServerDatabase,
	jobsTable,
	skillsTable,
	tokenUsageTable,
} from "adhdai/features/server";

export interface TestDatabase {
	database: ServerDatabase;
	cleanup(): Promise<void>;
}

export async function createServerTestDatabase(): Promise<TestDatabase> {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-server-db-"));
	const dbPath = path.join(tempDir, "server.pgdata");
	const database = await initializeServerDatabase(dbPath);

	return {
		database,
		async cleanup() {
			await database.close();
			await rm(tempDir, { recursive: true, force: true });
		},
	};
}

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
		backend: "codex",
		model: "gpt-5",
		createdAt: "2026-05-12T00:02:00.000Z",
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
}
