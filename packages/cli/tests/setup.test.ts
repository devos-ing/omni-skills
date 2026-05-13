import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { LoadedConfig } from "../src/features/config";
import { loadSqliteEnv } from "../src/features/config";
import {
	DEFAULT_LABEL_MAP,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
	LINEAR_API_KEY_SETTINGS_URL,
	type SetupDraft,
	collectSetupChecks,
	formatSetupChecks,
	mergeEnvFile,
	normalizeProjectId,
	renderEnvFile,
	renderLocalConfig,
	renderSetupGitHubInstallPrompt,
	renderSetupRtkInstallPrompt,
	writeSetupFiles,
} from "../src/features/setup";
import type { CommandResult } from "../src/utils/shell";

const draft: SetupDraft = {
	projectId: "demo-project",
	projectName: "Demo Project",
	workspacePath: "/tmp/demo",
	executionPath: "/tmp/demo",
	repoOwner: "octo",
	repoName: "demo",
	baseBranch: "main",
	linearApiKey: "lin_secret_123",
	notifications: {
		email: {
			enabled: true,
			resendApiKey: "re_secret_123",
			from: "adhd-ai@example.com",
			to: ["alerts@example.com", "ops@example.com"],
		},
	},
	statusMap: DEFAULT_STATUS_MAP,
	labelMap: DEFAULT_LABEL_MAP,
	codex: {
		reasoningEfforts: {
			plan: "medium",
			implement: "low",
			reviewTest: "medium",
			githubComment: "medium",
		},
		models: {
			plan: "gpt-5.5",
			implement: "gpt-5.3-codex",
			reviewTest: "gpt-5.3-codex",
			githubComment: "gpt-5.3-codex",
		},
		plugins: ["github@openai-curated", "linear@openai-curated"],
		skillsets: ["adhd-ai"],
		configOverrides: {
			"features.codex_hooks": "true",
		},
		sandbox: "workspace-write",
	},
};

describe("setup helpers", () => {
	it("normalizes project ids for non-technical names", () => {
		expect(normalizeProjectId("My First Project!")).toBe("my-first-project");
		expect(normalizeProjectId("   ")).toBe("default");
	});

	it("renders secrets only to env file", () => {
		const env = renderEnvFile(draft);
		const localConfig = renderLocalConfig(draft);
		expect(env).toContain("LINEAR_API_KEY=lin_secret_123");
		expect(env).toContain("RESEND_API_KEY=re_secret_123");
		expect(localConfig).not.toContain("lin_secret_123");
		expect(localConfig).not.toContain("re_secret_123");
		expect(localConfig).toContain("demo-project");
		expect(localConfig).toContain('"enabled": true');
		expect(localConfig).toContain('"from": "adhd-ai@example.com"');
		expect(localConfig).toContain('"to": [');
		expect(localConfig).toContain('"alerts@example.com"');
		expect(localConfig).toContain('"ops@example.com"');
		expect(localConfig).toContain('"root": `${cwd}/skills`');
		expect(localConfig).toContain('"plan": "piv-plan/SKILL.md"');
		expect(localConfig).toContain('"reasoningEfforts": {');
		expect(localConfig).toContain('"implement": "low"');
	});

	it("uses low as default implementation reasoning effort", () => {
		expect(DEFAULT_REASONING_EFFORTS.implement).toBe("low");
	});

	it("uses low as default planning reasoning effort", () => {
		expect(DEFAULT_REASONING_EFFORTS.plan).toBe("low");
	});

	it("exports the Linear API key settings URL used by setup prompts", () => {
		expect(LINEAR_API_KEY_SETTINGS_URL).toBe(
			"https://linear.app/settings/account/security",
		);
	});

	it("merges env updates without dropping unrelated values", () => {
		const merged = mergeEnvFile("KEEP_ME=yes\nLINEAR_API_KEY=old\n", {
			LINEAR_API_KEY: "new secret",
		});
		expect(merged).toContain("KEEP_ME=yes");
		expect(merged).toContain('LINEAR_API_KEY="new secret"');
		expect(merged).not.toContain("LINEAR_API_KEY=old");
	});

	it("writes setup secrets to sqlite and preserves env fallback", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-test-"));
		try {
			await writeSetupFiles(tempDir, draft);
			const sqliteEnv = await loadSqliteEnv(tempDir);
			expect(sqliteEnv?.LINEAR_API_KEY).toBe("lin_secret_123");
			expect(sqliteEnv?.RESEND_API_KEY).toBe("re_secret_123");

			const envPath = path.join(tempDir, ".env");
			const envContent = await readFile(envPath, "utf8");
			expect(envContent).toContain("LINEAR_API_KEY=lin_secret_123");
			expect(envContent).toContain("RESEND_API_KEY=re_secret_123");
			expect(envContent).toContain("RESEND_FROM=adhd-ai@example.com");
			expect(envContent).toContain(
				'RESEND_TO="alerts@example.com,ops@example.com"',
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("formats setup checks", () => {
		expect(
			formatSetupChecks([
				{ name: "Config", status: "pass", message: "ok" },
				{ name: "Codex", status: "fail", message: "missing" },
			]),
		).toBe("PASS: Config - ok\nFAIL: Codex - missing\n");
	});

	it("reports successful minimal setup checks", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () => loadedConfig({ linearApiKey: "lin_secret_123" }),
			access: async () => {},
			readFile: async () => "",
			runCommand: async () => okCommand(),
		});

		expect(checks.every((check) => check.status === "pass")).toBe(true);
	});

	it("reports missing Linear API key", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () => loadedConfig({ linearApiKey: "" }),
			access: async () => {},
			readFile: async () => "",
			runCommand: async () => okCommand(),
		});

		expect(checks).toContainEqual({
			name: "Linear API key",
			status: "fail",
			message: "missing for projects: demo-project",
		});
	});

	it("reports missing execution path", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () => loadedConfig({ linearApiKey: "lin_secret_123" }),
			access: async () => {
				throw new Error("missing");
			},
			readFile: async () => "",
			runCommand: async () => okCommand(),
		});

		expect(checks).toContainEqual({
			name: "Execution path (demo-project)",
			status: "fail",
			message: "/tmp/demo does not exist or is not accessible",
		});
	});

	it("reports missing skill files", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () => loadedConfig({ linearApiKey: "lin_secret_123" }),
			access: async (targetPath) => {
				if (targetPath === "/tmp/demo/skills/piv-implement/SKILL.md") {
					throw new Error("missing");
				}
			},
			readFile: async () => "",
			runCommand: async () => okCommand(),
		});

		expect(checks).toContainEqual({
			name: "Skill file (demo-project:implement)",
			status: "fail",
			message:
				"/tmp/demo/skills/piv-implement/SKILL.md does not exist or is not accessible",
		});
	});

	it("reports missing auto-select database when database source is enabled", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () => {
				const config = loadedConfig({ linearApiKey: "lin_secret_123" });
				const project = config.projects[0];
				if (project) {
					project.skills.autoSelect = {
						enabled: true,
						sources: {
							folder: true,
							database: true,
						},
						databasePath: "/tmp/demo/skills.db",
						maxSelected: 3,
					};
				}
				return config;
			},
			access: async (targetPath) => {
				if (targetPath === "/tmp/demo/skills.db") {
					throw new Error("missing");
				}
			},
			readFile: async () => "",
			runCommand: async () => okCommand(),
		});

		expect(checks).toContainEqual({
			name: "Skill auto-select database (demo-project)",
			status: "fail",
			message: "/tmp/demo/skills.db does not exist or is not accessible",
		});
	});

	it("reports secrets in tracked config", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () => loadedConfig({ linearApiKey: "lin_secret_123" }),
			access: async () => {},
			readFile: async (filePath) =>
				filePath.endsWith("adhd-ai.config.ts") ? "lin_secret_123" : "",
			runCommand: async () => okCommand(),
		});

		expect(checks).toContainEqual({
			name: "Tracked config secrets",
			status: "fail",
			message: "adhd-ai.config.ts contains a configured secret",
		});
	});

	it("reports missing rtk binary", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () => loadedConfig({ linearApiKey: "lin_secret_123" }),
			access: async () => {},
			readFile: async () => "",
			runCommand: async (command) =>
				command === "rtk"
					? {
							code: 1,
							stdout: "",
							stderr: "command not found: rtk",
						}
					: okCommand(),
		});

		expect(checks).toContainEqual({
			name: "RTK binary",
			status: "fail",
			message:
				"rtk binary not found. Install from: https://github.com/rtk-ai/rtk",
		});
	});

	it("reports missing docker binary when codex docker is enabled", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () =>
				loadedConfig({ linearApiKey: "lin_secret_123", dockerEnabled: true }),
			access: async () => {},
			readFile: async () => "",
			runCommand: async (command) =>
				command === "docker"
					? {
							code: 1,
							stdout: "",
							stderr: "command not found: docker",
						}
					: okCommand(),
		});

		expect(checks).toContainEqual({
			name: "Docker binary",
			status: "fail",
			message:
				"docker unavailable for codex.docker.enabled projects: command not found: docker",
		});
	});

	it("skips host codex check when only docker-backed codex projects are configured", async () => {
		const checks = await collectSetupChecks("/tmp/demo", {
			loadConfig: async () =>
				loadedConfig({ linearApiKey: "lin_secret_123", dockerEnabled: true }),
			access: async () => {},
			readFile: async () => "",
			runCommand: async (command) =>
				command === "codex"
					? {
							code: 1,
							stdout: "",
							stderr: "command not found: codex",
						}
					: okCommand(),
		});

		expect(
			checks.find((check) => check.name === "Codex binary"),
		).toBeUndefined();
		expect(checks).toContainEqual({
			name: "Docker binary",
			status: "pass",
			message: "docker is available",
		});
	});

	it("renders setup rtk install prompt", () => {
		expect(renderSetupRtkInstallPrompt()).toContain(
			"Install RTK before running workflows: https://github.com/rtk-ai/rtk",
		);
	});

	it("renders setup github install prompt", () => {
		expect(renderSetupGitHubInstallPrompt()).toContain(
			"Then authenticate: gh auth login",
		);
	});
});

function loadedConfig({
	linearApiKey,
	dockerEnabled = false,
}: {
	linearApiKey: string;
	dockerEnabled?: boolean;
}): LoadedConfig {
	return {
		projects: [
			{
				...draft,
				id: draft.projectId,
				name: draft.projectName,
				repo: {
					owner: draft.repoOwner,
					name: draft.repoName,
					baseBranch: draft.baseBranch,
				},
				linear: {
					apiKey: linearApiKey,
					apiUrl: "https://api.linear.app/graphql",
					pollLimit: 10,
					statusMap: DEFAULT_STATUS_MAP,
					labelMap: DEFAULT_LABEL_MAP,
					autoCreateLabels: true,
				},
				codex: {
					...draft.codex,
					binary: "codex",
					streamLogs: false,
					docker: dockerEnabled
						? {
								enabled: true,
								image: "codex:latest",
							}
						: undefined,
				},
				github: {
					useGhCli: true,
					defaultBugLabel: "bug",
				},
				server: {
					database: {
						databasePath: "/tmp/demo/.piv-loop/config/server-db",
					},
				},
				workflow: {
					issueConcurrency: 1,
				},
				dryRun: false,
				skills: {
					root: "/tmp/demo/skills",
					plan: "/tmp/demo/skills/piv-plan/SKILL.md",
					implement: "/tmp/demo/skills/piv-implement/SKILL.md",
					reviewTest: "/tmp/demo/skills/piv-review-test/SKILL.md",
					githubComment: "/tmp/demo/skills/piv-github-comment/SKILL.md",
				},
			},
		],
		polling: {
			intervalMs: 30000,
			exitWhenIdle: true,
			staleRunTimeoutMs: 3600000,
		},
		notifications: {
			email: {
				enabled: false,
				to: [],
			},
		},
	};
}

function okCommand(): CommandResult {
	return {
		code: 0,
		stdout: "ok",
		stderr: "",
	};
}
