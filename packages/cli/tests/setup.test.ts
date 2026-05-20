import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import type { LoadedConfig } from "../src/features/config";
import { loadSqliteEnv } from "../src/features/config";
import { PromptCancelledError } from "../src/features/prompts";
import type {
	PromptAdapter,
	SelectPromptOptions,
} from "../src/features/prompts";
import {
	DEFAULT_LABEL_MAP,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
	LINEAR_API_KEY_SETTINGS_URL,
	type SetupDraft,
	collectSetupChecks,
	collectSetupDraft,
	formatSetupChecks,
	mergeEnvFile,
	normalizeProjectId,
	renderEnvFile,
	renderInstanceConfig,
	renderLocalConfig,
	renderSetupGitHubInstallPrompt,
	renderSetupRtkInstallPrompt,
	runSetupWizard,
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
			from: "devos@example.com",
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
		skillsets: ["devos"],
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
		expect(localConfig).toContain('"from": "devos@example.com"');
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

	it("renders onboarding instance config from the local workspace", () => {
		const config = JSON.parse(
			renderInstanceConfig("/tmp/demo", "2026-05-12T16:13:11.419Z"),
		);

		expect(config).toEqual({
			$meta: {
				version: 1,
				updatedAt: "2026-05-12T16:13:11.419Z",
				source: "onboard",
			},
			database: {
				mode: "embedded-postgres",
				embeddedPostgresDataDir: "/tmp/demo/.devos/instances/default/db",
				embeddedPostgresPort: 54329,
				backup: {
					enabled: true,
					intervalMinutes: 60,
					retentionDays: 30,
					dir: "/tmp/demo/.devos/instances/default/data/backups",
				},
			},
			logging: {
				mode: "file",
				logDir: "/tmp/demo/.devos/instances/default/logs",
			},
			server: {
				deploymentMode: "local_trusted",
				exposure: "private",
				bind: "loopback",
				host: "127.0.0.1",
				port: 3100,
				allowedHostnames: [],
				serveUi: true,
			},
			auth: {
				baseUrlMode: "auto",
				disableSignUp: false,
			},
			telemetry: {
				enabled: true,
			},
			storage: {
				provider: "local_disk",
				localDisk: {
					baseDir: "/tmp/demo/.devos/instances/default/data/storage",
				},
				s3: {
					bucket: "devos",
					region: "us-east-1",
					prefix: "",
					forcePathStyle: false,
				},
			},
			secrets: {
				provider: "local_encrypted",
				strictMode: false,
				localEncrypted: {
					keyFilePath: "/tmp/demo/.devos/instances/default/secrets/master.key",
				},
			},
		});
	});

	it("uses low as default planning reasoning effort", () => {
		expect(DEFAULT_REASONING_EFFORTS.plan).toBe("low");
	});

	it("exports the Linear API key settings URL used by setup prompts", () => {
		expect(LINEAR_API_KEY_SETTINGS_URL).toBe(
			"https://linear.app/settings/account/security",
		);
	});

	it("maps typed onboarding prompts into the setup draft", async () => {
		const draft = await collectSetupDraft("/tmp/demo", {
			prompts: promptAdapter({
				text: {
					"Project name": "Demo Project",
					"Project ID": "demo-project",
					"Local repository path": "/tmp/demo",
					"GitHub owner": "octo",
					"GitHub repository name": "demo",
					"GitHub base branch": "main",
					"Linear project ID filter (optional)": "linear-project",
					"Linear team ID filter (optional; inferred from project when possible)":
						"linear-team",
					"Resend sender email": "devos@example.com",
					"Resend recipients (comma-separated)":
						"alerts@example.com, ops@example.com",
					"Planning model": "gpt-5.5",
					"Implementation model": "gpt-5.3-codex",
					"Review/testing model": "gpt-5.3-codex",
				},
				password: {
					"Linear API key (create one: https://linear.app/settings/account/security)":
						"lin_secret_123",
					"Resend API key": "re_secret_123",
				},
				confirm: {
					"Enable email notifications?": true,
					"Enable GitHub and Linear Codex plugins?": false,
				},
				select: {
					"Codex sandbox": "danger-full-access",
					"Planning reasoning effort": "medium",
					"Implementation reasoning effort": "low",
					"Review/testing reasoning effort": "high",
				},
			}),
			inferGitHubDefaults: async () => ({}),
		});

		expect(draft.linearApiKey).toBe("lin_secret_123");
		expect(draft.notifications.email).toMatchObject({
			enabled: true,
			resendApiKey: "re_secret_123",
			from: "devos@example.com",
			to: ["alerts@example.com", "ops@example.com"],
		});
		expect(draft.codex.sandbox).toBe("danger-full-access");
		expect(draft.codex.reasoningEfforts).toMatchObject({
			plan: "medium",
			implement: "low",
			reviewTest: "high",
			githubComment: "high",
		});
		expect(draft.codex.plugins).toEqual([]);
	});

	it("does not write setup files when onboarding prompts are cancelled", async () => {
		let wroteFiles = false;
		await expect(
			runSetupWizard("/tmp/demo", {
				runCommand: async () => okCommand(),
				prompts: {
					...promptAdapter({}),
					text: async () => {
						throw new PromptCancelledError();
					},
				},
				writeSetupFiles: async () => {
					wroteFiles = true;
				},
			}),
		).rejects.toBeInstanceOf(PromptCancelledError);
		expect(wroteFiles).toBe(false);
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
			expect(envContent).toContain("RESEND_FROM=devos@example.com");
			expect(envContent).toContain(
				'RESEND_TO="alerts@example.com,ops@example.com"',
			);

			const instanceConfigPath = path.join(
				tempDir,
				".devos/config/instance.config.json",
			);
			const instanceConfig = JSON.parse(
				await readFile(instanceConfigPath, "utf8"),
			);
			expect(instanceConfig.$meta.source).toBe("onboard");
			expect(instanceConfig.database.mode).toBe("embedded-postgres");
			expect(instanceConfig.server.port).toBe(3100);
			expect(instanceConfig.storage.localDisk.baseDir).toBe(
				path.join(tempDir, ".devos", "instances", "default", "data", "storage"),
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
				filePath.endsWith("devos.config.ts") ? "lin_secret_123" : "",
			runCommand: async () => okCommand(),
		});

		expect(checks).toContainEqual({
			name: "Tracked config secrets",
			status: "fail",
			message: "devos.config.ts contains a configured secret",
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
						databasePath: "/tmp/demo/.devos/config/server-db",
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

function promptAdapter(values: {
	text?: Record<string, string>;
	password?: Record<string, string>;
	confirm?: Record<string, boolean>;
	select?: Record<string, string>;
}): PromptAdapter {
	return {
		text: async ({ message, defaultValue }) =>
			values.text?.[message] ?? defaultValue ?? "",
		password: async ({ message }) => values.password?.[message] ?? "",
		confirm: async ({ message, initialValue }) =>
			values.confirm?.[message] ?? initialValue ?? false,
		select: async <Value extends string>({
			message,
			options,
			initialValue,
		}: SelectPromptOptions<Value>) =>
			options.find((option) => option.value === values.select?.[message])
				?.value ??
			initialValue ??
			options[0]?.value ??
			("" as Value),
	};
}
