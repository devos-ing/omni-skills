import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import {
	loadConfig,
	saveSqliteEnv,
	sqliteEnvDbPath,
} from "../src/features/config";

const envKeys = [
	"LINEAR_API_KEY",
	"LINEAR_PROJECT_ID",
	"LINEAR_TEAM_ID",
	"LINEAR_STATUS_BACKLOG",
	"LINEAR_STATUS_ASSIGNED",
	"LINEAR_STATUS_PLANNING",
	"LINEAR_STATUS_IMPLEMENTING",
	"LINEAR_STATUS_PR_CREATED",
	"LINEAR_STATUS_REVIEWING",
	"LINEAR_STATUS_TESTING",
	"LINEAR_STATUS_BLOCKED",
	"LINEAR_STATUS_DONE",
	"PIV_WORKSPACE_PATH",
	"PIV_EXECUTION_PATH",
	"CODEX_SANDBOX",
	"CODEX_HOME",
	"CODEX_REASONING_EFFORT",
	"CODEX_REASONING_EFFORT_PLAN",
	"CODEX_REASONING_EFFORT_IMPLEMENT",
	"CODEX_REASONING_EFFORT_REVIEW_TEST",
	"CODEX_REASONING_EFFORT_GITHUB_COMMENT",
	"CODEX_FAST_MODE_PLAN",
	"CODEX_FAST_MODE_IMPLEMENT",
	"CODEX_FAST_MODE_REVIEW_TEST",
	"CODEX_FAST_MODE_GITHUB_COMMENT",
	"CODEX_MODEL_PLAN",
	"CODEX_MODEL_IMPLEMENT",
	"CODEX_MODEL_REVIEW_TEST",
	"CODEX_MODEL_GITHUB_COMMENT",
	"CODEX_DOCKER_ENABLED",
	"CODEX_DOCKER_IMAGE",
	"CODEX_DOCKER_BINARY",
	"CODEX_DOCKER_WORKSPACE_PATH",
	"CODEX_DOCKER_EXECUTION_PATH",
	"CODEX_DOCKER_CODEX_HOME_PATH",
	"PIV_DEV_MODE",
	"PIV_PRINT_CODEX_LOGS",
	"PIV_POLL_INTERVAL_MS",
	"PIV_MAX_POLL_CYCLES",
	"PIV_EXIT_WHEN_IDLE",
	"PIV_STALE_RUN_TIMEOUT_MS",
	"PIV_ISSUE_CONCURRENCY",
	"PIV_ISOLATED_WORKTREES",
	"RESEND_API_KEY",
	"RESEND_FROM",
	"RESEND_TO",
	"AGENT_BACKEND",
	"CLAUDE_CODE_MODEL",
	"CLAUDE_CODE_MAX_TURNS",
	"CLAUDE_CODE_ALLOWED_TOOLS",
	"PIV_SERVER_DATABASE_PATH",
] as const;

const previousEnv: Record<string, string | undefined> = {};

describe("loadConfig", () => {
	beforeEach(() => {
		for (const key of envKeys) {
			previousEnv[key] = process.env[key];
			process.env[key] =
				key === "RESEND_API_KEY" || key === "RESEND_FROM" || key === "RESEND_TO"
					? ""
					: key === "CODEX_SANDBOX"
						? "workspace-write"
						: key === "CODEX_HOME" ||
								key === "CODEX_REASONING_EFFORT" ||
								key === "CODEX_REASONING_EFFORT_PLAN" ||
								key === "CODEX_REASONING_EFFORT_IMPLEMENT" ||
								key === "CODEX_REASONING_EFFORT_REVIEW_TEST" ||
								key === "CODEX_REASONING_EFFORT_GITHUB_COMMENT" ||
								key === "CODEX_FAST_MODE_PLAN" ||
								key === "CODEX_FAST_MODE_IMPLEMENT" ||
								key === "CODEX_FAST_MODE_REVIEW_TEST" ||
								key === "CODEX_FAST_MODE_GITHUB_COMMENT" ||
								key === "CODEX_DOCKER_ENABLED" ||
								key === "CODEX_DOCKER_IMAGE" ||
								key === "CODEX_DOCKER_BINARY" ||
								key === "CODEX_DOCKER_WORKSPACE_PATH" ||
								key === "CODEX_DOCKER_EXECUTION_PATH" ||
								key === "CODEX_DOCKER_CODEX_HOME_PATH" ||
								key === "CLAUDE_CODE_MODEL" ||
								key === "CLAUDE_CODE_ALLOWED_TOOLS" ||
								key === "PIV_SERVER_DATABASE_PATH"
							? ""
							: key === "PIV_POLL_INTERVAL_MS"
								? "30000"
								: key === "PIV_MAX_POLL_CYCLES" ||
										key === "CLAUDE_CODE_MAX_TURNS"
									? ""
									: key === "PIV_DEV_MODE" || key === "PIV_PRINT_CODEX_LOGS"
										? "0"
										: key === "PIV_EXIT_WHEN_IDLE"
											? "1"
											: key === "PIV_STALE_RUN_TIMEOUT_MS"
												? "3600000"
												: key === "PIV_ISSUE_CONCURRENCY"
													? "1"
													: key === "PIV_ISOLATED_WORKTREES"
														? "0"
														: key === "AGENT_BACKEND"
															? ""
															: key.toLowerCase();
		}
	});

	afterEach(() => {
		for (const key of envKeys) {
			process.env[key] = previousEnv[key];
		}
	});

	it("loads required env values", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.linear.apiKey).toBe("linear_api_key");
			expect(config.projects[0]?.linear.projectId).toBe("linear_project_id");
			expect(config.projects[0]?.linear.teamId).toBe("linear_team_id");
			expect(config.projects[0]?.linear.statusMap.backlog).toBe(
				"linear_status_backlog",
			);
			expect(config.projects[0]?.linear.statusMap.assigned).toBe(
				"linear_status_assigned",
			);
			expect(config.projects[0]?.executionPath).toBe("piv_execution_path");
			expect(config.polling.intervalMs).toBe(30000);
			expect(config.polling.maxCycles).toBeUndefined();
			expect(config.polling.exitWhenIdle).toBe(true);
			expect(config.polling.staleRunTimeoutMs).toBe(3600000);
			expect(config.notifications.email.enabled).toBe(false);
			expect(config.projects[0]?.skills.root).toBe(
				path.join(tempDir, "skills"),
			);
			expect(config.projects[0]?.skills.plan).toBe(
				path.join(tempDir, "skills", "piv-plan", "SKILL.md"),
			);
			expect(config.projects[0]?.skills.implement).toBe(
				path.join(tempDir, "skills", "piv-implement", "SKILL.md"),
			);
			expect(config.projects[0]?.skills.reviewTest).toBe(
				path.join(tempDir, "skills", "piv-review-test", "SKILL.md"),
			);
			expect(config.projects[0]?.skills.githubComment).toBe(
				path.join(tempDir, "skills", "piv-github-comment", "SKILL.md"),
			);
			expect(config.projects[0]?.skills.createTask).toBe(
				path.join(tempDir, "skills", "adhd-explore", "SKILL.md"),
			);
			expect(config.projects[0]?.skills.autoSelect).toEqual({
				enabled: false,
				sources: {
					folder: true,
					database: false,
				},
				databasePath: path.join(
					tempDir,
					".piv-loop",
					"config",
					"skills.sqlite",
				),
				maxSelected: 3,
			});
			expect(config.projects[0]?.workflow.issueConcurrency).toBe(1);
			expect(config.projects[0]?.workflow.isolatedWorktrees).toEqual({
				enabled: false,
			});
			expect(config.projects[0]?.server.database.databasePath).toBe(
				path.join(tempDir, ".piv-loop", "config", "server-db"),
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("supports server database path from env and root/project overrides", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		process.env.PIV_SERVER_DATABASE_PATH = "./from-env/server-db";
		await writeFile(
			path.join(tempDir, "adhd-ai.config.ts"),
			[
				"export default {",
				"  server: {",
				"    database: {",
				"      databasePath: './root/server-db'",
				"    }",
				"  },",
				"  projects: [",
				"    {",
				"      id: 'default',",
				"      server: {",
				"        database: {",
				"          databasePath: './project/server-db'",
				"        }",
				"      }",
				"    }",
				"  ]",
				"};",
				"",
			].join("\n"),
		);

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.server.database.databasePath).toBe(
				path.resolve(tempDir, "./project/server-db"),
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("loads env values from sqlite when process env is unset", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		await saveSqliteEnv(tempDir, {
			LINEAR_API_KEY: "lin_sqlite_key",
			PIV_POLL_INTERVAL_MS: "45000",
			RESEND_API_KEY: "re_sqlite",
			RESEND_FROM: "ADHD.ai <ops@example.com>",
			RESEND_TO: "a@example.com,b@example.com",
		});
		process.env.LINEAR_API_KEY = undefined;
		process.env.PIV_POLL_INTERVAL_MS = undefined;
		process.env.RESEND_API_KEY = undefined;
		process.env.RESEND_FROM = undefined;
		process.env.RESEND_TO = undefined;

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.linear.apiKey).toBe("lin_sqlite_key");
			expect(config.polling.intervalMs).toBe(45000);
			expect(config.notifications.email.enabled).toBe(true);
			expect(config.notifications.email.resendApiKey).toBe("re_sqlite");
			expect(config.notifications.email.to).toEqual([
				"a@example.com",
				"b@example.com",
			]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("prefers process env over sqlite values", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		await saveSqliteEnv(tempDir, {
			LINEAR_API_KEY: "lin_sqlite_key",
		});
		process.env.LINEAR_API_KEY = "lin_env_key";

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.linear.apiKey).toBe("lin_env_key");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("falls back to process env when sqlite db is missing", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		process.env.LINEAR_API_KEY = "lin_env_key";

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.linear.apiKey).toBe("lin_env_key");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("throws when sqlite db exists but env_config schema is invalid", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		await saveSqliteEnv(tempDir, {
			LINEAR_API_KEY: "lin_sqlite_key",
		});
		const dbPath = sqliteEnvDbPath(tempDir);
		process.env.LINEAR_API_KEY = undefined;
		const db = new Database(dbPath, { create: true });
		try {
			db.run("DROP TABLE env_config");
			db.run("CREATE TABLE broken (key TEXT PRIMARY KEY, value TEXT NOT NULL)");
		} finally {
			db.close(false);
		}

		try {
			await expect(loadConfig(tempDir)).rejects.toThrow("env_config");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("loads agent backend from AGENT_BACKEND env", async () => {
		process.env.AGENT_BACKEND = "claude-code";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.agent?.backend).toBe("claude-code");
	});

	it("defaults agent backend to undefined when not set", async () => {
		process.env.AGENT_BACKEND = "";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.agent?.backend).toBeUndefined();
	});

	it("rejects invalid AGENT_BACKEND value", async () => {
		process.env.AGENT_BACKEND = "invalid-backend";
		await expect(loadConfig(process.cwd())).rejects.toThrow(
			"Invalid AGENT_BACKEND value: 'invalid-backend'",
		);
	});

	it("loads Claude Code model from CLAUDE_CODE_MODEL env", async () => {
		process.env.CLAUDE_CODE_MODEL = "claude-sonnet-4-20250514";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.agent?.model).toBe("claude-sonnet-4-20250514");
	});

	it("loads Claude Code max turns from CLAUDE_CODE_MAX_TURNS env", async () => {
		process.env.CLAUDE_CODE_MAX_TURNS = "50";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.agent?.maxTurns).toBe(50);
	});

	it("ignores non-positive CLAUDE_CODE_MAX_TURNS", async () => {
		process.env.CLAUDE_CODE_MAX_TURNS = "0";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.agent?.maxTurns).toBeUndefined();
	});

	it("loads Claude Code allowed tools from CLAUDE_CODE_ALLOWED_TOOLS env", async () => {
		process.env.CLAUDE_CODE_ALLOWED_TOOLS = "Read,Write,Bash";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.agent?.allowedTools).toEqual([
			"Read",
			"Write",
			"Bash",
		]);
	});

	it("returns undefined allowed tools when env is empty", async () => {
		process.env.CLAUDE_CODE_ALLOWED_TOOLS = "";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.agent?.allowedTools).toBeUndefined();
	});

	it("allows config file to override agent settings", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		await writeFile(
			path.join(tempDir, "adhd-ai.config.ts"),
			[
				"export default {",
				"  agent: {",
				"    backend: 'claude-code',",
				"    model: 'claude-opus-4-20250514',",
				"    maxTurns: 100,",
				"    allowedTools: ['Read', 'Write'],",
				"  },",
				"  projects: [",
				"    { id: 'default' }",
				"  ]",
				"};",
				"",
			].join("\n"),
		);

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.agent?.backend).toBe("claude-code");
			expect(config.projects[0]?.agent?.model).toBe("claude-opus-4-20250514");
			expect(config.projects[0]?.agent?.maxTurns).toBe(100);
			expect(config.projects[0]?.agent?.allowedTools).toEqual([
				"Read",
				"Write",
			]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
