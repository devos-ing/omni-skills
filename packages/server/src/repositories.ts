import type { ServerDatabase } from "./db";
import type {
	AgentRecord,
	BoardProjectRecord,
	BoardTaskRecord,
	CommandHistoryRecord,
	JobRecord,
	ProjectBoardRecord,
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

function parseStringList(value: string | number | Date | null): string[] {
	if (typeof value !== "string") {
		return [];
	}
	try {
		const parsed = JSON.parse(value) as unknown;
		if (
			!Array.isArray(parsed) ||
			!parsed.every((entry) => typeof entry === "string")
		) {
			return [];
		}
		return parsed;
	} catch {
		return [];
	}
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
				`SELECT id, name, description, logo, runtime, backend, model, concurrency, owner, created_at, updated_at, skills, recent_work, activity, instructions
				 FROM agents
				 ORDER BY id ASC`,
				(row): AgentRecord => ({
					id: String(row.id),
					name: String(row.name),
					description: String(row.description),
					logo: String(row.logo),
					runtime: String(row.runtime),
					backend: String(row.backend),
					model: String(row.model),
					concurrency: Number(row.concurrency),
					owner: String(row.owner),
					createdAt: normalizeTimestamp(row.created_at),
					updatedAt: normalizeTimestamp(row.updated_at),
					skills: parseStringList(row.skills),
					recentWork: parseStringList(row.recent_work),
					activity: parseStringList(row.activity),
					instructions: String(row.instructions),
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
		listProjectBoards: () =>
			readRows(
				database,
				`SELECT id, name, description, owner_id, created_at, updated_at
				 FROM project_boards
				 ORDER BY id ASC`,
				(row): ProjectBoardRecord => ({
					id: String(row.id),
					name: String(row.name),
					description:
						row.description === null ? null : String(row.description),
					ownerId: String(row.owner_id),
					createdAt: normalizeTimestamp(row.created_at),
					updatedAt: normalizeTimestamp(row.updated_at),
				}),
			),
		listBoardProjects: () =>
			readRows(
				database,
				`SELECT id, board_id, external_project_id, name, description, owner_id, created_at, updated_at
				 FROM board_projects
				 ORDER BY id ASC`,
				(row): BoardProjectRecord => ({
					id: String(row.id),
					boardId: String(row.board_id),
					externalProjectId:
						row.external_project_id === null
							? null
							: String(row.external_project_id),
					name: String(row.name),
					description:
						row.description === null ? null : String(row.description),
					ownerId: String(row.owner_id),
					createdAt: normalizeTimestamp(row.created_at),
					updatedAt: normalizeTimestamp(row.updated_at),
				}),
			),
		listBoardTasks: () =>
			readRows(
				database,
				`SELECT id, task_key, project_id, title, content, priority, status, due_date, creator_id, linked_pr, linear_issue_id, linear_identifier, linear_url, created_at, updated_at
				 FROM board_tasks
				 ORDER BY id ASC`,
				(row): BoardTaskRecord => ({
					id: String(row.id),
					taskKey: String(row.task_key),
					projectId: row.project_id === null ? null : String(row.project_id),
					title: String(row.title),
					content: String(row.content),
					priority: Number(row.priority),
					status: String(row.status),
					dueDate:
						row.due_date === null ? null : normalizeTimestamp(row.due_date),
					creatorId: String(row.creator_id),
					linkedPr: row.linked_pr === null ? null : String(row.linked_pr),
					linearIssueId:
						row.linear_issue_id === null ? null : String(row.linear_issue_id),
					linearIdentifier:
						row.linear_identifier === null
							? null
							: String(row.linear_identifier),
					linearUrl: row.linear_url === null ? null : String(row.linear_url),
					createdAt: normalizeTimestamp(row.created_at),
					updatedAt: normalizeTimestamp(row.updated_at),
				}),
			),
	};
}
