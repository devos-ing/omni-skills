import { describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "devos-db";
import {
	ServerDatabaseInitializationError,
	agentsTable,
	initializeServerDatabase,
	jobsTable,
} from "devos-db";

describe("server database initialization", () => {
	it("initializes a fresh database from migrations only", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-init-"));
		const database = await initializeServerDatabase(path.join(tempDir, "db"));

		try {
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
				createdAt: "2026-05-12 00:02:00",
				updatedAt: "2026-05-12 00:03:00",
				skills: "[]",
				recentWork: "[]",
				activity: "[]",
				instructions: "Keep responses implementation-focused.",
			});

			const [agent] = await database.db
				.select()
				.from(agentsTable)
				.where(eq(agentsTable.id, "agent-1"));
			expect(agent?.name).toBe("codex-main");
		} finally {
			await database.close();
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("can close and reopen the same database path", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-init-"));
		const databasePath = path.join(tempDir, "db");
		const firstDatabase = await initializeServerDatabase(databasePath);

		try {
			await firstDatabase.db.insert(jobsTable).values({
				id: "job-1",
				projectId: "default",
				issueKey: "TASK-000001",
				stage: "implementing",
				status: "in_progress",
				createdAt: "2026-05-12 00:01:00",
			});
		} finally {
			await firstDatabase.close();
		}

		const reopenedDatabase = await initializeServerDatabase(databasePath);
		try {
			const [job] = await reopenedDatabase.db
				.select()
				.from(jobsTable)
				.where(eq(jobsTable.id, "job-1"));
			expect(job?.issueKey).toBe("TASK-000001");
		} finally {
			await reopenedDatabase.close();
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("wraps startup failures with phase and database path", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-init-"));
		const blockerPath = path.join(tempDir, "not-a-directory");
		const databasePath = path.join(blockerPath, "db");
		await writeFile(blockerPath, "blocks directory creation");

		try {
			await initializeServerDatabase(databasePath);
			throw new Error("Expected initializeServerDatabase to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ServerDatabaseInitializationError);
			expect((error as ServerDatabaseInitializationError).phase).toBe(
				"create_directory",
			);
			expect((error as ServerDatabaseInitializationError).databasePath).toBe(
				path.resolve(databasePath),
			);
			expect((error as Error).cause).toBeDefined();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
