import { Database } from "bun:sqlite";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export interface TestDatabase {
	path: string;
	cleanup(): Promise<void>;
}

export async function createServerTestDatabase(): Promise<TestDatabase> {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-server-db-"));
	const dbPath = path.join(tempDir, "server.sqlite");
	const db = new Database(dbPath, { create: true });
	try {
		db.run(
			"CREATE TABLE token_usage (id TEXT PRIMARY KEY, run_id TEXT NOT NULL, task_id TEXT, task_execution_log_id TEXT, stage TEXT NOT NULL, agent_backend TEXT, model TEXT, input_tokens INTEGER NOT NULL, output_tokens INTEGER NOT NULL, total_tokens INTEGER NOT NULL, estimated_cost_microusd INTEGER, recorded_at TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE jobs (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, issue_key TEXT NOT NULL, stage TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE agents (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, logo TEXT NOT NULL, runtime TEXT NOT NULL, backend TEXT NOT NULL, model TEXT NOT NULL, reasoning_effort TEXT, status TEXT NOT NULL DEFAULT 'online', concurrency INTEGER NOT NULL, owner TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, skills TEXT NOT NULL, recent_work TEXT NOT NULL, activity TEXT NOT NULL, instructions TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE skills (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL, source TEXT NOT NULL, updated_at TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE command_history (id TEXT PRIMARY KEY, command TEXT NOT NULL, exit_code INTEGER NOT NULL, executed_at TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE project_boards (id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT, owner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE board_projects (id TEXT PRIMARY KEY, board_id TEXT NOT NULL, external_project_id TEXT, name TEXT NOT NULL, description TEXT, owner_id TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
		);
		db.run(
			"CREATE TABLE board_tasks (id TEXT PRIMARY KEY, project_id TEXT NOT NULL, title TEXT NOT NULL, content TEXT NOT NULL, priority INTEGER NOT NULL, status TEXT NOT NULL, due_date TEXT, creator_id TEXT NOT NULL, linked_pr TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)",
		);
	} finally {
		db.close(false);
	}

	return {
		path: dbPath,
		async cleanup() {
			await rm(tempDir, { recursive: true, force: true });
		},
	};
}

export function seedServerTestDatabase(dbPath: string): void {
	const db = new Database(dbPath);
	try {
		db.run(
			"INSERT INTO token_usage (id, run_id, stage, input_tokens, output_tokens, total_tokens, recorded_at) VALUES ('tu-1', 'run-1', 'planning', 10, 5, 15, '2026-05-12T00:00:00.000Z')",
		);
		db.run(
			"INSERT INTO jobs (id, project_id, issue_key, stage, status, created_at) VALUES ('job-1', 'default', 'ROY-129', 'implementing', 'in_progress', '2026-05-12T00:01:00.000Z')",
		);
		db.run(
			"INSERT INTO agents (id, name, description, logo, runtime, backend, model, reasoning_effort, status, concurrency, owner, created_at, updated_at, skills, recent_work, activity, instructions) VALUES ('agent-1', 'codex-main', 'Primary coding agent', 'https://example.com/codex.svg', 'codex', 'codex', 'gpt-5', NULL, 'online', 2, 'owner-1', '2026-05-12T00:02:00.000Z', '2026-05-12T00:03:00.000Z', '[\"adhd-plan\",\"adhd-implement\"]', '[\"ROY-228\"]', '[\"planning\"]', 'Keep responses implementation-focused.')",
		);
		db.run(
			"INSERT INTO skills (id, name, description, source, updated_at) VALUES ('skill-1', 'backend-standard', 'Backend implementation guidance', 'folder', '2026-05-12T00:03:00.000Z')",
		);
		db.run(
			"INSERT INTO command_history (id, command, exit_code, executed_at) VALUES ('cmd-1', 'bun test', 0, '2026-05-12T00:04:00.000Z')",
		);
		db.run(
			"INSERT INTO project_boards (id, name, description, owner_id, created_at, updated_at) VALUES ('board-1', 'Workspace Board', 'Primary board for workspace planning', 'owner-1', '2026-05-12T00:05:00.000Z', '2026-05-12T00:05:00.000Z')",
		);
		db.run(
			"INSERT INTO board_projects (id, board_id, external_project_id, name, description, owner_id, created_at, updated_at) VALUES ('project-1', 'board-1', 'ext-project-42', 'API Hardening', 'Contract and route updates', 'owner-1', '2026-05-12T00:06:00.000Z', '2026-05-12T00:06:00.000Z')",
		);
		db.run(
			"INSERT INTO board_tasks (id, project_id, title, content, priority, status, due_date, creator_id, linked_pr, created_at, updated_at) VALUES ('task-1', 'project-1', 'Document board APIs', 'Update OpenAPI and tests for board endpoints', 2, 'todo', NULL, 'owner-1', NULL, '2026-05-12T00:07:00.000Z', '2026-05-12T00:07:00.000Z')",
		);
	} finally {
		db.close(false);
	}
}
