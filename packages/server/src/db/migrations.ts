import { readFile } from "node:fs/promises";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";

interface Migration {
	id: string;
	fileName: string;
}

const MIGRATIONS: Migration[] = [
	{ id: "0001_initial_schema", fileName: "0001_initial_schema.sql" },
	{ id: "0002_token_usage_upgrade", fileName: "0002_token_usage_upgrade.sql" },
	{ id: "0003_project_cron_jobs", fileName: "0003_project_cron_jobs.sql" },
	{
		id: "0006_board_task_linear_refs",
		fileName: "0006_board_task_linear_refs.sql",
	},
	{ id: "0004_inbox_messages", fileName: "0004_inbox_messages.sql" },
	{ id: "0005_agent_details", fileName: "0005_agent_details.sql" },
];

async function ensureMigrationsTable(client: PGlite): Promise<void> {
	await client.exec(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id text PRIMARY KEY,
			applied_at timestamp NOT NULL
		);
	`);
}

export async function runMigrations(client: PGlite): Promise<void> {
	await ensureMigrationsTable(client);

	const migrationsDir = path.join(import.meta.dir, "migrations");
	for (const migration of MIGRATIONS) {
		const existing = await client.query<{ id: string }>(
			"SELECT id FROM schema_migrations WHERE id = $1",
			[migration.id],
		);
		if (existing.rows.length > 0) {
			continue;
		}

		const sql = await readFile(
			path.join(migrationsDir, migration.fileName),
			"utf8",
		);
		await client.exec("BEGIN;");
		try {
			await client.exec(sql);
			await client.query(
				"INSERT INTO schema_migrations (id, applied_at) VALUES ($1, CURRENT_TIMESTAMP)",
				[migration.id],
			);
			await client.exec("COMMIT;");
		} catch (error) {
			await client.exec("ROLLBACK;");
			throw error;
		}
	}
}
