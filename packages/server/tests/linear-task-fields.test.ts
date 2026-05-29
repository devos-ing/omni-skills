import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { eq } from "devos-db";
import { boardTasksTable, initializeServerDatabase } from "devos-db";

describe("legacy linear task reference fields", () => {
	it("adds Linear ref columns when opening an existing board task table", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-linear-db-"));
		const databasePath = path.join(tempDir, "db");

		try {
			const oldDatabase = await initializeServerDatabase(databasePath, {
				runMigrations: false,
			});
			await oldDatabase.client.query(`
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
			await oldDatabase.close();

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
