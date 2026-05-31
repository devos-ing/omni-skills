import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { boardProjectsTable, eq, initializeServerDatabase } from "devos-db";

describe("project emoji migration", () => {
	it("adds emoji metadata to existing board projects", async () => {
		const tempDir = await mkdtemp(
			path.join(os.tmpdir(), "devos-project-emoji-"),
		);
		const databasePath = path.join(tempDir, "db");

		try {
			const oldDatabase = await initializeServerDatabase(databasePath, {
				runMigrations: false,
			});
			await oldDatabase.client.query(`
				CREATE TABLE project_boards (
					id text PRIMARY KEY,
					name text NOT NULL,
					description text,
					owner_id text NOT NULL,
					created_at timestamp NOT NULL,
					updated_at timestamp NOT NULL
				);
				CREATE TABLE board_projects (
					id text PRIMARY KEY,
					board_id text NOT NULL REFERENCES project_boards(id),
					external_project_id text,
					name text NOT NULL,
					description text,
					owner_id text NOT NULL,
					created_at timestamp NOT NULL,
					updated_at timestamp NOT NULL
				);
				INSERT INTO project_boards (
					id, name, description, owner_id, created_at, updated_at
				) VALUES (
					'board-1', 'Board', NULL, 'owner-1',
					'2026-05-20 00:00:00', '2026-05-20 00:00:00'
				);
				INSERT INTO board_projects (
					id, board_id, external_project_id, name, description, owner_id,
					created_at, updated_at
				) VALUES (
					'project-1', 'board-1', NULL, 'Project', NULL, 'owner-1',
					'2026-05-20 00:01:00', '2026-05-20 00:01:00'
				);
			`);
			await oldDatabase.close();

			const migrated = await initializeServerDatabase(databasePath);
			await migrated.db
				.update(boardProjectsTable)
				.set({ emoji: "🧭" })
				.where(eq(boardProjectsTable.id, "project-1"));
			const [project] = await migrated.db
				.select()
				.from(boardProjectsTable)
				.where(eq(boardProjectsTable.id, "project-1"));

			expect(project?.emoji).toBe("🧭");
			await migrated.close();
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
