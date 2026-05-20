import { afterEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { boardProjectsTable, boardTasksTable } from "devos-db/schema";
import { backupDatabase } from "../scripts/backup";
import { migrateDatabase } from "../scripts/migrate";
import { seedDatabase } from "../scripts/seed";
import { initializeServerDatabase } from "../src";
import { projectBoardsTable } from "../src/schema";

const tempDirs: string[] = [];

afterEach(async () => {
	await Promise.all(
		tempDirs
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("database scripts", () => {
	it("runs migrations for a fresh PGlite database", async () => {
		const dbPath = await createDatabasePath();

		const result = await migrateDatabase({ dbPath });

		expect(result.dbPath).toBe(dbPath);
		const client = new PGlite(dbPath);
		try {
			const migrations = await client.query<{ id: string }>(
				"SELECT id FROM schema_migrations ORDER BY id",
			);
			expect(migrations.rows.length).toBeGreaterThan(0);
			expect(migrations.rows.at(-1)?.id).toBe("0011_project_metadata");
		} finally {
			await client.close();
		}
	});

	it("seeds deterministic dev data idempotently", async () => {
		const dbPath = await createDatabasePath();

		await seedDatabase({ dbPath });
		await seedDatabase({ dbPath });

		const database = await initializeServerDatabase(dbPath);
		try {
			const boards = await database.db.select().from(projectBoardsTable);
			expect(boards.filter((board) => board.id === "dev-board")).toHaveLength(
				1,
			);
		} finally {
			await database.close();
		}
	});

	it("copies a timestamped backup without mutating the source", async () => {
		const dbPath = await createDatabasePath();
		await migrateDatabase({ dbPath });

		const result = await backupDatabase({
			dbPath,
			now: new Date("2026-05-20T01:02:03.004Z"),
		});

		expect(result.sourcePath).toBe(dbPath);
		expect(result.backupPath).toBe(`${dbPath}.backup-20260520T010203004Z`);
		expect((await stat(dbPath)).isDirectory()).toBe(true);
		expect((await stat(result.backupPath)).isDirectory()).toBe(true);
		await expect(readMigrationCount(dbPath)).resolves.toBeGreaterThan(0);
		await expect(
			readMigrationCount(result.backupPath),
		).resolves.toBeGreaterThan(0);
	});

	it("keeps schema package exports available", () => {
		expect(boardTasksTable).toBeDefined();
		expect(boardTasksTable.id).toBeDefined();
		expect(boardProjectsTable.repoName).toBeDefined();
	});
});

async function createDatabasePath(): Promise<string> {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-test-"));
	tempDirs.push(tempDir);
	return path.join(tempDir, "server-db");
}

async function readMigrationCount(dbPath: string): Promise<number> {
	const client = new PGlite(dbPath);
	try {
		const result = await client.query<{ count: string }>(
			"SELECT COUNT(*) AS count FROM schema_migrations",
		);
		return Number(result.rows[0]?.count ?? 0);
	} finally {
		await client.close();
	}
}
