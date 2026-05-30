import { readFile } from "node:fs/promises";
import path from "node:path";
import type { QueryResultRow } from "pg";

interface Migration {
	id: string;
	fileName: string;
}

export interface MigrationQueryClient {
	query<T extends QueryResultRow = QueryResultRow>(
		sql: string,
		values?: unknown[],
	): Promise<{ rows: T[] }>;
}

const MIGRATIONS: Migration[] = [
	{ id: "0001_initial_schema", fileName: "0001_initial_schema.sql" },
	{ id: "0002_token_usage_upgrade", fileName: "0002_token_usage_upgrade.sql" },
	{ id: "0003_project_cron_jobs", fileName: "0003_project_cron_jobs.sql" },
	{ id: "0004_inbox_messages", fileName: "0004_inbox_messages.sql" },
	{ id: "0005_agent_details", fileName: "0005_agent_details.sql" },
	{
		id: "0006_board_task_linear_refs",
		fileName: "0006_board_task_linear_refs.sql",
	},
	{
		id: "0007_nullable_board_task_project",
		fileName: "0007_nullable_board_task_project.sql",
	},
	{ id: "0008_board_task_keys", fileName: "0008_board_task_keys.sql" },
	{
		id: "0009_merge_pr_created_status",
		fileName: "0009_merge_pr_created_status.sql",
	},
	{
		id: "0010_polling_observability",
		fileName: "0010_polling_observability.sql",
	},
	{
		id: "0011_project_metadata",
		fileName: "0011_project_metadata.sql",
	},
	{
		id: "0012_task_pull_request_branch",
		fileName: "0012_task_pull_request_branch.sql",
	},
	{
		id: "0013_chat_sessions",
		fileName: "0013_chat_sessions.sql",
	},
	{
		id: "0014_chat_session_task_id",
		fileName: "0014_chat_session_task_id.sql",
	},
	{
		id: "0015_literal_backlog_plan_statuses",
		fileName: "0015_literal_backlog_plan_statuses.sql",
	},
	{
		id: "0016_chat_session_archive",
		fileName: "0016_chat_session_archive.sql",
	},
	{
		id: "0017_canonical_workflow_statuses",
		fileName: "0017_canonical_workflow_statuses.sql",
	},
	{
		id: "0018_token_usage_cost_metadata",
		fileName: "0018_token_usage_cost_metadata.sql",
	},
	{
		id: "0019_agent_status_reasoning",
		fileName: "0019_agent_status_reasoning.sql",
	},
];

async function ensureMigrationsTable(
	client: MigrationQueryClient,
): Promise<void> {
	await client.query(`
		CREATE TABLE IF NOT EXISTS schema_migrations (
			id text PRIMARY KEY,
			applied_at timestamp NOT NULL
		);
	`);
}

export async function runMigrations(
	client: MigrationQueryClient,
): Promise<void> {
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
		await client.query("BEGIN");
		try {
			await client.query(sql);
			await client.query(
				"INSERT INTO schema_migrations (id, applied_at) VALUES ($1, CURRENT_TIMESTAMP)",
				[migration.id],
			);
			await client.query("COMMIT");
		} catch (error) {
			await client.query("ROLLBACK");
			throw error;
		}
	}
}
