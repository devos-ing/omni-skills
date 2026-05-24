import { Database } from "bun:sqlite";
import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import {
	loadConfig,
	saveSqliteEnv,
	sqliteEnvDbPath,
} from "../src/features/config";

const envKeys = [
	"GITHUB_REPO_OWNER",
	"GITHUB_REPO_NAME",
	"GITHUB_BASE_BRANCH",
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
	"CODEX_PLUGINS",
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
	"CLAUDE_CODE_PERMISSION_MODE",
	"CURSOR_AGENT_BINARY",
	"CURSOR_AGENT_MODEL",
	"CURSOR_AGENT_FORCE",
	"CURSOR_API_KEY",
	"PIV_SERVER_DATABASE_PATH",
	"DEVOS_SERVER_BASE_URL",
] as const;

const previousEnv: Record<string, string | undefined> = {};
let previousHome: string | undefined;
let testHomeDir: string | undefined;

describe("loadConfig", () => {
	beforeEach(async () => {
		previousHome = process.env.HOME;
		testHomeDir = await mkdtemp(path.join(process.cwd(), ".tmp-config-home-"));
		process.env.HOME = testHomeDir;
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
								key === "CODEX_PLUGINS" ||
								key === "CODEX_DOCKER_ENABLED" ||
								key === "CODEX_DOCKER_IMAGE" ||
								key === "CODEX_DOCKER_BINARY" ||
								key === "CODEX_DOCKER_WORKSPACE_PATH" ||
								key === "CODEX_DOCKER_EXECUTION_PATH" ||
								key === "CODEX_DOCKER_CODEX_HOME_PATH" ||
								key === "CLAUDE_CODE_MODEL" ||
								key === "CLAUDE_CODE_PERMISSION_MODE" ||
								key === "CLAUDE_CODE_ALLOWED_TOOLS" ||
								key === "CURSOR_AGENT_MODEL" ||
								key === "CURSOR_API_KEY" ||
								key === "PIV_SERVER_DATABASE_PATH"
							? ""
							: key === "PIV_POLL_INTERVAL_MS"
								? "30000"
								: key === "PIV_MAX_POLL_CYCLES" ||
										key === "CLAUDE_CODE_MAX_TURNS"
									? ""
									: key === "PIV_DEV_MODE" || key === "PIV_PRINT_CODEX_LOGS"
										? "0"
										: key === "CURSOR_AGENT_BINARY"
											? "cursor-agent"
											: key === "CURSOR_AGENT_FORCE"
												? ""
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
		process.env.HOME = previousHome;
		const homeDir = testHomeDir;
		previousHome = undefined;
		testHomeDir = undefined;
		if (homeDir) {
			return rm(homeDir, { recursive: true, force: true });
		}
	});

	it("loads required env values", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.repo.owner).toBe("github_repo_owner");
			expect(config.projects[0]?.repo.name).toBe("github_repo_name");
			expect(config.projects[0]?.repo.baseBranch).toBe("github_base_branch");
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
				databasePath: path.join(tempDir, ".devos", "config", "skills.sqlite"),
				maxSelected: 3,
			});
			expect(config.projects[0]?.skills.pluginSkillPaths).toEqual([]);
			expect(config.projects[0]?.workflow.issueConcurrency).toBe(1);
			expect(config.projects[0]?.workflow.isolatedWorktrees).toEqual({
				enabled: false,
			});
			expect(config.projects[0]?.server.database.databasePath).toBe(
				path.join(tempDir, ".devos", "config", "server-db"),
			);
			expect(config.server.database.databasePath).toBe(
				path.join(tempDir, ".devos", "config", "server-db"),
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("supports server database path from env", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		process.env.PIV_SERVER_DATABASE_PATH = "./from-env/server-db";

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.server.database.databasePath).toBe(
				path.resolve(tempDir, "./from-env/server-db"),
			);
			expect(config.server.database.databasePath).toBe(
				path.resolve(tempDir, "./from-env/server-db"),
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
			GITHUB_REPO_OWNER: "octo",
			GITHUB_REPO_NAME: "demo",
			GITHUB_BASE_BRANCH: "trunk",
			LINEAR_API_KEY: "lin_sqlite_key",
			PIV_POLL_INTERVAL_MS: "45000",
			CODEX_PLUGINS: "github@openai-curated,linear@openai-curated",
			RESEND_API_KEY: "re_sqlite",
			RESEND_FROM: "devos.ing <ops@example.com>",
			RESEND_TO: "a@example.com,b@example.com",
		});
		process.env.GITHUB_REPO_OWNER = undefined;
		process.env.GITHUB_REPO_NAME = undefined;
		process.env.GITHUB_BASE_BRANCH = undefined;
		process.env.LINEAR_API_KEY = undefined;
		process.env.PIV_POLL_INTERVAL_MS = undefined;
		process.env.CODEX_PLUGINS = undefined;
		process.env.RESEND_API_KEY = undefined;
		process.env.RESEND_FROM = undefined;
		process.env.RESEND_TO = undefined;

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.repo).toEqual({
				owner: "octo",
				name: "demo",
				baseBranch: "trunk",
			});
			expect(config.projects[0]?.linear.apiKey).toBe("lin_sqlite_key");
			expect(config.projects[0]?.codex.plugins).toEqual([
				"github@openai-curated",
				"linear@openai-curated",
			]);
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

	it("overlays project metadata from the server when available", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		try {
			await withMockServerProjects(
				[
					serverProjectRow({
						id: "default",
						name: "Server Project",
						repoOwner: "octo",
						repoName: "server-repo",
						baseBranch: "trunk",
						localFolder: path.join(tempDir, "repo"),
					}),
				],
				async () => {
					const config = await loadConfig(tempDir);
					expect(config.projects[0]?.name).toBe("Server Project");
					expect(config.projects[0]?.workspacePath).toBe(
						path.join(tempDir, "repo"),
					);
					expect(config.projects[0]?.executionPath).toBe(
						path.join(tempDir, "repo"),
					);
					expect(config.projects[0]?.repo).toEqual({
						owner: "octo",
						name: "server-repo",
						baseBranch: "trunk",
					});
				},
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("loads web-created projects from the server when config projects are empty", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		try {
			await withMockServerProjects(
				[
					serverProjectRow({
						id: "project-1",
						name: "Web Project",
						repoOwner: "octo",
						repoName: "web-repo",
						baseBranch: "trunk",
						localFolder: path.join(tempDir, "web-repo"),
					}),
				],
				async () => {
					const config = await loadConfig(tempDir);
					expect(config.projects).toHaveLength(1);
					expect(config.projects[0]?.id).toBe("project-1");
					expect(config.projects[0]?.name).toBe("Web Project");
					expect(config.projects[0]?.workspacePath).toBe(
						path.join(tempDir, "web-repo"),
					);
					expect(config.projects[0]?.repo).toEqual({
						owner: "octo",
						name: "web-repo",
						baseBranch: "trunk",
					});
				},
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("ignores malformed project metadata from the server", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		try {
			await withMockServerProjects(
				[
					{
						id: "default",
						name: "Broken Project",
						repoOwner: 123,
						repoName: "server-repo",
						baseBranch: "trunk",
						localFolder: path.join(tempDir, "repo"),
					},
				],
				async () => {
					const config = await loadConfig(tempDir);
					expect(config.projects[0]?.name).toBe("default");
					expect(config.projects[0]?.repo).toEqual({
						owner: "github_repo_owner",
						name: "github_repo_name",
						baseBranch: "github_base_branch",
					});
				},
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("continues with configured projects when the server is unavailable", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		const previousFetch = globalThis.fetch;
		process.env.DEVOS_SERVER_BASE_URL = "http://127.0.0.1:3001";
		globalThis.fetch = mock(async () => {
			throw new Error("server unavailable");
		}) as unknown as typeof fetch;

		try {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.id).toBe("default");
			expect(config.projects[0]?.repo).toEqual({
				owner: "github_repo_owner",
				name: "github_repo_name",
				baseBranch: "github_base_branch",
			});
		} finally {
			globalThis.fetch = previousFetch;
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
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.agent?.backend).toBe("claude-code");
		});
	});

	it("loads Cursor Agent backend from AGENT_BACKEND env", async () => {
		process.env.AGENT_BACKEND = "cursor-agent";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.agent?.backend).toBe("cursor-agent");
		});
	});

	it("defaults agent backend to undefined when not set", async () => {
		process.env.AGENT_BACKEND = "";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.agent?.backend).toBeUndefined();
		});
	});

	it("rejects invalid AGENT_BACKEND value", async () => {
		process.env.AGENT_BACKEND = "invalid-backend";
		await withTempConfig(async (tempDir) => {
			await expect(loadConfig(tempDir)).rejects.toThrow(
				"Invalid AGENT_BACKEND value: 'invalid-backend'",
			);
		});
	});

	it("loads Cursor Agent settings from env", async () => {
		process.env.CURSOR_AGENT_BINARY = "custom-cursor-agent";
		process.env.CURSOR_AGENT_MODEL = "gpt-5";
		process.env.CURSOR_AGENT_FORCE = "true";
		process.env.CURSOR_API_KEY = "cursor_secret";

		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.cursor).toEqual({
				binary: "custom-cursor-agent",
				streamLogs: false,
				model: "gpt-5",
				force: true,
				apiKey: "cursor_secret",
			});
		});
	});

	it("loads Claude Code model from CLAUDE_CODE_MODEL env", async () => {
		process.env.CLAUDE_CODE_MODEL = "claude-sonnet-4-20250514";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.claude?.model).toBe(
				"claude-sonnet-4-20250514",
			);
		});
	});

	it("loads Claude Code max turns from CLAUDE_CODE_MAX_TURNS env", async () => {
		process.env.CLAUDE_CODE_MAX_TURNS = "50";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.claude?.maxTurns).toBe(50);
		});
	});

	it("ignores non-positive CLAUDE_CODE_MAX_TURNS", async () => {
		process.env.CLAUDE_CODE_MAX_TURNS = "0";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.claude?.maxTurns).toBeUndefined();
		});
	});

	it("loads Claude Code allowed tools from CLAUDE_CODE_ALLOWED_TOOLS env", async () => {
		process.env.CLAUDE_CODE_ALLOWED_TOOLS = "Read,Write,Bash";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.claude?.allowedTools).toEqual([
				"Read",
				"Write",
				"Bash",
			]);
		});
	});

	it("returns undefined allowed tools when env is empty", async () => {
		process.env.CLAUDE_CODE_ALLOWED_TOOLS = "";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.claude?.allowedTools).toBeUndefined();
		});
	});

	it("loads Claude Code permission mode from CLAUDE_CODE_PERMISSION_MODE env", async () => {
		process.env.CLAUDE_CODE_PERMISSION_MODE = "plan";
		await withTempConfig(async (tempDir) => {
			const config = await loadConfig(tempDir);
			expect(config.projects[0]?.claude?.permissionMode).toBe("plan");
		});
	});
});

async function withTempConfig(
	run: (tempDir: string) => Promise<void>,
): Promise<void> {
	const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-config-test-"));
	try {
		await run(tempDir);
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

async function withMockServerProjects(
	rows: unknown[],
	run: () => Promise<void>,
): Promise<void> {
	const previousFetch = globalThis.fetch;
	const previousBaseUrl = process.env.DEVOS_SERVER_BASE_URL;
	process.env.DEVOS_SERVER_BASE_URL = "http://127.0.0.1:3001";
	globalThis.fetch = mock(async (input: RequestInfo | URL) => {
		expect(String(input)).toBe("http://127.0.0.1:3001/api/projects");
		return Response.json(rows);
	}) as unknown as typeof fetch;
	try {
		await run();
	} finally {
		globalThis.fetch = previousFetch;
		process.env.DEVOS_SERVER_BASE_URL = previousBaseUrl;
	}
}

function serverProjectRow(
	overrides: Partial<Record<string, unknown>> = {},
): Record<string, unknown> {
	return {
		id: "default",
		boardId: "board-1",
		externalProjectId: "default",
		name: "Server Project",
		description: "From server",
		repoOwner: "octo",
		repoName: "server-repo",
		baseBranch: "main",
		localFolder: "/tmp/server-repo",
		lead: "Roy",
		category: "platform",
		priority: 3,
		ownerId: "owner-1",
		createdAt: "2026-05-20T00:00:00.000Z",
		updatedAt: "2026-05-20T00:00:00.000Z",
		...overrides,
	};
}
