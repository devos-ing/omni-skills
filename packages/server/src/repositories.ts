import type { ServerDatabase } from "adhdai/features/server";
import type {
	AgentRecord,
	CommandHistoryRecord,
	JobRecord,
	ReadRepositories,
	SkillRecord,
	TokenUsageRecord,
} from "./repositories.types";

interface QueryResultRow {
	[key: string]: string | number | Date | null;
}

function normalizeTimestamp(value: string | number | Date | null): string {
	if (value === null) {
		return "";
	}
	if (typeof value === "number") {
		return new Date(value).toISOString();
	}
	if (value instanceof Date) {
		return value.toISOString();
	}
	const parsed = new Date(value);
	if (!Number.isNaN(parsed.getTime())) {
		return parsed.toISOString();
	}
	return value;
}

async function readRows<T>(
	database: ServerDatabase,
	sql: string,
	map: (row: QueryResultRow) => T,
): Promise<T[]> {
	const result = await database.client.query<QueryResultRow>(sql);
	return result.rows.map(map);
}

export function createReadRepositories(
	database: ServerDatabase,
): ReadRepositories {
	return {
		listTokenUsage: async () =>
			readRows(
				database,
				`SELECT id, run_id, stage, input_tokens, output_tokens, total_tokens, recorded_at
				 FROM token_usage
				 ORDER BY id ASC`,
				(row): TokenUsageRecord => ({
					id: String(row.id),
					runId: String(row.run_id),
					stage: String(row.stage),
					inputTokens: Number(row.input_tokens),
					outputTokens: Number(row.output_tokens),
					totalTokens: Number(row.total_tokens),
					recordedAt: normalizeTimestamp(row.recorded_at),
				}),
			),
		listJobs: async () =>
			readRows(
				database,
				`SELECT id, project_id, issue_key, stage, status, created_at
				 FROM jobs
				 ORDER BY id ASC`,
				(row): JobRecord => ({
					id: String(row.id),
					projectId: String(row.project_id),
					issueKey: String(row.issue_key),
					stage: String(row.stage),
					status: String(row.status),
					createdAt: normalizeTimestamp(row.created_at),
				}),
			),
		listAgents: async () =>
			readRows(
				database,
				`SELECT id, name, backend, model, created_at
				 FROM agents
				 ORDER BY id ASC`,
				(row): AgentRecord => ({
					id: String(row.id),
					name: String(row.name),
					backend: String(row.backend),
					model: String(row.model),
					createdAt: normalizeTimestamp(row.created_at),
				}),
			),
		listSkills: async () =>
			readRows(
				database,
				`SELECT id, name, description, source, updated_at
				 FROM skills
				 ORDER BY id ASC`,
				(row): SkillRecord => ({
					id: String(row.id),
					name: String(row.name),
					description: String(row.description),
					source: String(row.source),
					updatedAt: normalizeTimestamp(row.updated_at),
				}),
			),
		listCommandHistory: async () =>
			readRows(
				database,
				`SELECT id, command, exit_code, executed_at
				 FROM command_history
				 ORDER BY id ASC`,
				(row): CommandHistoryRecord => ({
					id: String(row.id),
					command: String(row.command),
					exitCode: Number(row.exit_code),
					executedAt: normalizeTimestamp(row.executed_at),
				}),
			),
	};
}
