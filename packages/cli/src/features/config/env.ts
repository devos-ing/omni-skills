import path from "node:path";
import type {
	PollingConfig,
	ProjectRuntimeConfig,
	ResolvedNotificationConfig,
} from "../../features/types";
import {
	AUTO_SELECT_SKILLS_DB_FILE,
	SERVER_DB_DIR,
	SQLITE_ENV_DIR,
} from "./constants";
import {
	normalizeAgentBackend,
	normalizeBooleanEnvValue,
	normalizeOptionalValue,
	normalizePermissionMode,
	normalizeReasoningEffortValue,
	normalizeSandboxValue,
	parseCommaList,
	parseOptionalPositiveInt,
	parseRecipientsFromEnv,
} from "./env-normalizers";
import { loadSqliteEnv } from "./sqlite-env";

export type ResolvedEnv = Record<string, string | undefined>;

export async function loadResolvedEnv(cwd: string): Promise<ResolvedEnv> {
	const sqliteEnv = await loadSqliteEnv(cwd);
	const resolved: ResolvedEnv = { ...(sqliteEnv ?? {}) };
	for (const [key, value] of Object.entries(process.env)) {
		if (value !== undefined) {
			resolved[key] = value;
		}
	}
	return resolved;
}

export function buildEnvBase(
	cwd: string,
	env: ResolvedEnv,
): ProjectRuntimeConfig {
	const workspacePath = env.PIV_WORKSPACE_PATH ?? cwd;
	const sandbox = normalizeSandboxValue(env.CODEX_SANDBOX);
	const codexHome = normalizeOptionalValue(env.CODEX_HOME);
	return {
		workspacePath,
		executionPath: env.PIV_EXECUTION_PATH ?? workspacePath,
		repo: {
			owner: env.GITHUB_REPO_OWNER ?? "",
			name: env.GITHUB_REPO_NAME ?? "",
			baseBranch: env.GITHUB_BASE_BRANCH ?? "main",
		},
		linear: {
			apiKey: env.LINEAR_API_KEY ?? "",
			apiUrl: env.LINEAR_API_URL ?? "https://api.linear.app/graphql",
			projectId: normalizeOptionalValue(env.LINEAR_PROJECT_ID),
			teamId: env.LINEAR_TEAM_ID,
			requiredLabel: env.LINEAR_REQUIRED_LABEL,
			pollLimit: Number(env.PIV_POLL_LIMIT ?? "10"),
			statusMap: {
				backlog: env.LINEAR_STATUS_BACKLOG ?? "Backlog",
				assigned: env.LINEAR_STATUS_ASSIGNED ?? "Todo",
				planning: env.LINEAR_STATUS_PLANNING ?? "In Progress",
				implementing: env.LINEAR_STATUS_IMPLEMENTING ?? "In Progress",
				pr_created: env.LINEAR_STATUS_PR_CREATED ?? "In Review",
				reviewing: env.LINEAR_STATUS_REVIEWING ?? "In Review",
				testing: env.LINEAR_STATUS_TESTING ?? "In Review",
				blocked: env.LINEAR_STATUS_BLOCKED ?? "Canceled",
				done: env.LINEAR_STATUS_DONE ?? "Done",
			},
			labelMap: {
				pr_created: env.LINEAR_LABEL_PR_CREATED ?? "PR Created",
				reviewing: env.LINEAR_LABEL_REVIEWING ?? "Reviewing",
				testing: env.LINEAR_LABEL_TESTING ?? "Testing",
			},
			autoCreateLabels: env.LINEAR_AUTO_CREATE_LABELS !== "0",
		},
		github: {
			useGhCli: true,
			defaultBugLabel: env.GITHUB_BUG_LABEL ?? "bug",
		},
		server: {
			database: {
				databasePath:
					normalizeOptionalValue(env.PIV_SERVER_DATABASE_PATH) ??
					path.join(cwd, SQLITE_ENV_DIR, SERVER_DB_DIR),
			},
		},
		codex: {
			binary: env.CODEX_BINARY ?? "codex",
			streamLogs: env.PIV_DEV_MODE === "1" || env.PIV_PRINT_CODEX_LOGS === "1",
			model: env.CODEX_MODEL,
			reasoningEffort: normalizeReasoningEffortValue(
				env.CODEX_REASONING_EFFORT,
				"CODEX_REASONING_EFFORT",
			),
			models: {
				plan: env.CODEX_MODEL_PLAN,
				implement: env.CODEX_MODEL_IMPLEMENT,
				reviewTest: env.CODEX_MODEL_REVIEW_TEST,
				githubComment: env.CODEX_MODEL_GITHUB_COMMENT,
			},
			reasoningEfforts: {
				plan: normalizeReasoningEffortValue(
					env.CODEX_REASONING_EFFORT_PLAN,
					"CODEX_REASONING_EFFORT_PLAN",
				),
				implement: normalizeReasoningEffortValue(
					env.CODEX_REASONING_EFFORT_IMPLEMENT,
					"CODEX_REASONING_EFFORT_IMPLEMENT",
				),
				reviewTest: normalizeReasoningEffortValue(
					env.CODEX_REASONING_EFFORT_REVIEW_TEST,
					"CODEX_REASONING_EFFORT_REVIEW_TEST",
				),
				githubComment: normalizeReasoningEffortValue(
					env.CODEX_REASONING_EFFORT_GITHUB_COMMENT,
					"CODEX_REASONING_EFFORT_GITHUB_COMMENT",
				),
			},
			fastModes: {
				plan: normalizeBooleanEnvValue(
					env.CODEX_FAST_MODE_PLAN,
					"CODEX_FAST_MODE_PLAN",
				),
				implement: normalizeBooleanEnvValue(
					env.CODEX_FAST_MODE_IMPLEMENT,
					"CODEX_FAST_MODE_IMPLEMENT",
				),
				reviewTest: normalizeBooleanEnvValue(
					env.CODEX_FAST_MODE_REVIEW_TEST,
					"CODEX_FAST_MODE_REVIEW_TEST",
				),
				githubComment: normalizeBooleanEnvValue(
					env.CODEX_FAST_MODE_GITHUB_COMMENT,
					"CODEX_FAST_MODE_GITHUB_COMMENT",
				),
			},
			sandbox,
			codexHome,
			docker: {
				enabled: normalizeBooleanEnvValue(
					env.CODEX_DOCKER_ENABLED,
					"CODEX_DOCKER_ENABLED",
				),
				image: normalizeOptionalValue(env.CODEX_DOCKER_IMAGE),
				binary: normalizeOptionalValue(env.CODEX_DOCKER_BINARY),
				workspacePath: normalizeOptionalValue(env.CODEX_DOCKER_WORKSPACE_PATH),
				executionPath: normalizeOptionalValue(env.CODEX_DOCKER_EXECUTION_PATH),
				codexHomePath: normalizeOptionalValue(env.CODEX_DOCKER_CODEX_HOME_PATH),
			},
		},
		cursor: {
			binary: normalizeOptionalValue(env.CURSOR_AGENT_BINARY) ?? "cursor-agent",
			streamLogs: env.PIV_DEV_MODE === "1" || env.PIV_PRINT_CODEX_LOGS === "1",
			model: normalizeOptionalValue(env.CURSOR_AGENT_MODEL),
			force: normalizeBooleanEnvValue(
				env.CURSOR_AGENT_FORCE,
				"CURSOR_AGENT_FORCE",
			),
			apiKey: normalizeOptionalValue(env.CURSOR_API_KEY),
		},
		skills: {
			root: path.join(cwd, "skills"),
			plan: path.join("piv-plan", "SKILL.md"),
			implement: path.join("piv-implement", "SKILL.md"),
			reviewTest: path.join("piv-review-test", "SKILL.md"),
			githubComment: path.join("piv-github-comment", "SKILL.md"),
			createTask: path.join("adhd-explore", "SKILL.md"),
			autoSelect: {
				enabled: false,
				sources: { folder: true, database: false },
				databasePath: path.join(
					cwd,
					SQLITE_ENV_DIR,
					AUTO_SELECT_SKILLS_DB_FILE,
				),
				maxSelected: 3,
			},
		},
		agent: {
			backend: normalizeAgentBackend(env.AGENT_BACKEND),
			model: normalizeOptionalValue(env.CLAUDE_CODE_MODEL),
			maxTurns: parseOptionalPositiveInt(env.CLAUDE_CODE_MAX_TURNS),
			allowedTools: parseCommaList(env.CLAUDE_CODE_ALLOWED_TOOLS),
			permissionMode: normalizePermissionMode(env.CLAUDE_CODE_PERMISSION_MODE),
		},
		workflow: {
			issueConcurrency: Number(env.PIV_ISSUE_CONCURRENCY ?? "1"),
			isolatedWorktrees: {
				enabled: env.PIV_ISOLATED_WORKTREES === "1",
			},
		},
		dryRun: env.PIV_DRY_RUN === "1",
	};
}

export function buildEnvPolling(env: ResolvedEnv): PollingConfig {
	return {
		intervalMs: Number(env.PIV_POLL_INTERVAL_MS ?? "30000"),
		maxCycles: parseOptionalPositiveInt(env.PIV_MAX_POLL_CYCLES),
		exitWhenIdle: env.PIV_EXIT_WHEN_IDLE !== "0",
		staleRunTimeoutMs: Number(env.PIV_STALE_RUN_TIMEOUT_MS ?? "3600000"),
	};
}

export function buildEnvNotifications(
	env: ResolvedEnv,
): ResolvedNotificationConfig {
	return {
		email: {
			enabled: false,
			resendApiKey: normalizeOptionalValue(env.RESEND_API_KEY),
			from: normalizeOptionalValue(env.RESEND_FROM),
			to: parseRecipientsFromEnv(env.RESEND_TO),
		},
	};
}
