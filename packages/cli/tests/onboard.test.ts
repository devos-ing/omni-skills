import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import type { LoadedConfig } from "../src/features/config";
import {
	devosHomeInstanceRoot,
	instanceConfigPath,
	loadSqliteEnv,
	sqliteEnvDbPath,
} from "../src/features/config";
import {
	DEFAULT_LABEL_MAP,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
	type OnboardCheckDeps,
	type OnboardDraft,
	collectOnboardChecks,
	collectOnboardDraft,
	createDefaultOnboardInstanceDraft,
	createInstanceConfig,
	formatOnboardChecks,
	loadInstanceConfig,
	mergeEnvFile,
	normalizeProjectId,
	renderDevosBanner,
	renderEnvFile,
	renderInstanceConfig,
	renderOnboardGitHubInstallPrompt,
	renderOnboardRtkInstallPrompt,
	runOnboardWizard,
	writeOnboardFiles,
} from "../src/features/onboard";
import { PromptCancelledError } from "../src/features/prompts";
import type {
	PromptAdapter,
	SelectPromptOptions,
} from "../src/features/prompts";
import type { CommandResult } from "../src/utils/shell";

const checkProjectId = "demo-project";
const checkProjectName = "Demo Project";
const checkRepoOwner = "octo";
const checkRepoName = "demo";
const checkBaseBranch = "main";
let draft: OnboardDraft;
let previousHome: string | undefined;
let testHomeDir: string | undefined;

describe("onboard helpers", () => {
	beforeEach(async () => {
		previousHome = process.env.HOME;
		testHomeDir = await mkdtemp(path.join(process.cwd(), ".tmp-onboard-home-"));
		process.env.HOME = testHomeDir;
		draft = createTestDraft();
	});

	afterEach(async () => {
		process.env.HOME = previousHome;
		if (testHomeDir) {
			await rm(testHomeDir, { recursive: true, force: true });
		}
		previousHome = undefined;
		testHomeDir = undefined;
	});

	it("normalizes project ids for non-technical names", () => {
		expect(normalizeProjectId("My First Project!")).toBe("my-first-project");
		expect(normalizeProjectId("   ")).toBe("default");
	});

	it("keeps project metadata and secrets out of the generated env file", () => {
		const env = renderEnvFile(draft);
		expect(env).not.toContain("LINEAR_API_KEY");
		expect(env).toContain("RESEND_API_KEY=re_secret_123");
		expect(env).not.toContain("octo");
		expect(env).not.toContain("Demo Project");
		expect(env).not.toContain("Demo description");
		expect(env).not.toContain("Demo Workspace");
		expect(env).not.toContain("/tmp/demo");
	});

	it("uses medium as default implementation reasoning effort", () => {
		expect(DEFAULT_REASONING_EFFORTS.implement).toBe("medium");
	});

	it("renders onboarding instance config from the devos home directory", () => {
		const instanceRoot = devosHomeInstanceRoot();
		const config = JSON.parse(
			renderInstanceConfig("/tmp/demo", "2026-05-12T16:13:11.419Z"),
		);

		expect(config).toEqual({
			$meta: {
				version: 1,
				updatedAt: "2026-05-12T16:13:11.419Z",
				source: "onboard",
			},
			workspace: {
				id: "owner-1",
				name: "Default Workspace",
			},
			database: {
				mode: "embedded-postgres",
				embeddedPostgresDataDir: path.join(instanceRoot, "db"),
				embeddedPostgresPort: 54329,
				backup: {
					enabled: true,
					intervalMinutes: 60,
					retentionDays: 30,
					dir: path.join(instanceRoot, "data", "backups"),
				},
			},
			logging: {
				mode: "file",
				logDir: path.join(instanceRoot, "logs"),
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
					baseDir: path.join(instanceRoot, "data", "storage"),
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
					keyFilePath: path.join(instanceRoot, "secrets", "master.key"),
				},
			},
			plugins: {
				installed: [],
			},
		});
	});

	it("writes Codex model settings into the instance config during onboard", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-onboard-test-"),
		);

		try {
			await writeOnboardFiles(tempDir, draft);
			const loaded = await loadInstanceConfig(tempDir);
			expect(loaded.ok).toBe(true);
			if (!loaded.ok) return;
			expect(loaded.config.codex?.models).toEqual(draft.codex.models);
			expect(loaded.config.codex?.reasoningEfforts).toEqual(
				draft.codex.reasoningEfforts,
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("uses high as default planning reasoning effort", () => {
		expect(DEFAULT_REASONING_EFFORTS.plan).toBe("high");
	});

	it("maps typed onboarding prompts into the onboard draft", async () => {
		const textPrompts: string[] = [];
		const prompts = promptAdapter({
			text: {
				"Workspace name": "Demo Workspace",
			},
		});
		const inferGitHubDefaults = mock(async () => ({
			owner: "octo",
			name: "demo",
			baseBranch: "main",
		}));
		const draft = await collectOnboardDraft("/tmp/demo", {
			prompts: {
				...prompts,
				text: async (options) => {
					textPrompts.push(options.message);
					return prompts.text(options);
				},
			},
			inferGitHubDefaults,
		});

		expect(inferGitHubDefaults).not.toHaveBeenCalled();
		expect(draft.workspaceName).toBe("Demo Workspace");
		expect(draft.workspacePath).toBe("/tmp/demo");
		expect(draft.executionPath).toBe("/tmp/demo");
		expect(draft.notifications.email).toEqual({
			enabled: false,
			to: [],
		});
		expect(draft.workflow.isolatedWorktrees).toBe(true);
		expect(draft.statusMap).toEqual(DEFAULT_STATUS_MAP);
		expect(draft.codex.sandbox).toBe("workspace-write");
		expect(draft.codex.reasoningEfforts).toMatchObject({
			plan: "high",
			implement: "medium",
			reviewTest: "medium",
			githubComment: "medium",
		});
		expect(draft.codex.plugins).toEqual(["github@openai-curated"]);
		expect(textPrompts).toEqual(["Workspace name"]);
	});

	it("does not write onboard files when onboarding prompts are cancelled", async () => {
		let wroteFiles = false;
		await expect(
			runOnboardWizard("/tmp/demo", {
				runCommand: async () => okCommand(),
				prompts: {
					...promptAdapter({}),
					text: async () => {
						throw new PromptCancelledError();
					},
				},
				writeOnboardFiles: async () => {
					wroteFiles = true;
				},
			}),
		).rejects.toBeInstanceOf(PromptCancelledError);
		expect(wroteFiles).toBe(false);
	});

	it("runs post-onboard doctor after writing files and keeps JWT secret out of output", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-onboard-test-"),
		);
		const collectChecks = mock(async (cwd: string) => {
			const sqliteEnv = await loadSqliteEnv(cwd);
			expect(sqliteEnv?.JWT_SECRET).toBeTruthy();
			return [
				{ name: "Instance config", status: "pass" as const, message: "ok" },
			];
		});
		try {
			const output = await captureStdout(() =>
				runOnboardWizard(tempDir, {
					runCommand: async () => okCommand(),
					prompts: onboardingPromptAdapter(),
					collectOnboardChecks: collectChecks,
				}),
			);
			const sqliteEnv = await loadSqliteEnv(tempDir);
			const jwtSecret = sqliteEnv?.JWT_SECRET ?? "missing JWT_SECRET";
			expect(collectChecks).toHaveBeenCalledTimes(1);
			expect(output).toContain("Onboarding files written:");
			expect(output).toContain(`Instance config: ${instanceConfigPath()}`);
			expect(output).toContain(`Secrets saved to ${sqliteEnvDbPath(tempDir)}`);
			expect(output).toContain(renderDevosBanner());
			expect(
				output
					.split("\n")
					.some((line) => line.includes("Running doctor checks...")),
			).toBe(true);
			expect(output).toContain("Summary");
			expect(output).toContain("1 passed");
			expect(output).toContain("Instance config");
			expect(output).toContain("ok");
			expect(output).toContain("All checks passed!");
			expect(output).not.toContain(jwtSecret);

			const successIndex = output.indexOf("Onboarding files written:");
			const bannerIndex = output.indexOf(renderDevosBanner());
			const doctorIndex = output.indexOf("Running doctor checks...");
			const resultsIndex = output.indexOf("Instance config", doctorIndex);
			expect(successIndex).toBeLessThan(bannerIndex);
			expect(bannerIndex).toBeLessThan(doctorIndex);
			expect(doctorIndex).toBeLessThan(resultsIndex);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("merges env updates without dropping unrelated values", () => {
		const merged = mergeEnvFile("KEEP_ME=yes\nCUSTOM_SECRET=old\n", {
			CUSTOM_SECRET: "new secret",
		});
		expect(merged).toContain("KEEP_ME=yes");
		expect(merged).toContain('CUSTOM_SECRET="new secret"');
		expect(merged).not.toContain("CUSTOM_SECRET=old");
	});

	it("preserves existing env values when onboarding has no replacement", () => {
		const merged = mergeEnvFile("CUSTOM_SECRET=old\nKEEP_ME=yes\n", {
			CUSTOM_SECRET: undefined,
			JWT_SECRET: "jwt",
		});

		expect(merged).toContain("CUSTOM_SECRET=old");
		expect(merged).toContain("KEEP_ME=yes");
		expect(merged).toContain("JWT_SECRET=jwt");
	});

	it("renders isolated worktree onboarding env by default", () => {
		const env = renderEnvFile(draft);

		expect(env).toContain("PIV_ISOLATED_WORKTREES=1");
	});

	it("writes integration values to sqlite without touching the server DB", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-onboard-test-"),
		);
		try {
			await writeOnboardFiles(tempDir, draft);
			const sqliteEnv = await loadSqliteEnv(tempDir);
			expect(sqliteEnv?.PIV_ISOLATED_WORKTREES).toBe("1");
			expect(sqliteEnv?.GITHUB_REPO_OWNER).toBeUndefined();
			expect(sqliteEnv?.GITHUB_REPO_NAME).toBeUndefined();
			expect(sqliteEnv?.GITHUB_BASE_BRANCH).toBeUndefined();
			expect(sqliteEnv?.RESEND_API_KEY).toBe("re_secret_123");
			expect(sqliteEnv?.JWT_SECRET).toMatch(/^[A-Za-z0-9_-]+$/);
			expect(sqliteEnv?.JWT_SECRET?.length).toBeGreaterThan(40);

			await expect(
				access(path.join(tempDir, ".devos", "config", "server-db")),
			).rejects.toThrow();

			const envPath = path.join(tempDir, ".env");
			const envContent = await readFile(envPath, "utf8");
			expect(envContent).toContain("PIV_ISOLATED_WORKTREES=1");
			expect(envContent).not.toContain("LINEAR_API_KEY");
			expect(envContent).not.toContain("GITHUB_REPO_OWNER");
			expect(envContent).not.toContain("GITHUB_REPO_NAME");
			expect(envContent).not.toContain("GITHUB_BASE_BRANCH");
			expect(envContent).toContain("RESEND_API_KEY=re_secret_123");
			expect(envContent).toContain("RESEND_FROM=devos@example.com");
			expect(envContent).toContain(
				'RESEND_TO="alerts@example.com,ops@example.com"',
			);
			expect(envContent).toContain(`JWT_SECRET=${sqliteEnv?.JWT_SECRET}`);
			await expect(
				access(path.join(tempDir, "devos.local.config.ts")),
			).rejects.toThrow();

			const instanceConfig = JSON.parse(
				await readFile(instanceConfigPath(), "utf8"),
			);
			expect(instanceConfig.$meta.source).toBe("onboard");
			expect(instanceConfig.database.mode).toBe("embedded-postgres");
			expect(instanceConfig.server.port).toBe(3100);
			expect(instanceConfig.storage.localDisk.baseDir).toBe(
				path.join(devosHomeInstanceRoot(), "data", "storage"),
			);
			await access(instanceConfig.storage.localDisk.baseDir);
			await access(instanceConfig.database.embeddedPostgresDataDir);
			await access(instanceConfig.database.backup.dir);
			await access(instanceConfig.logging.logDir);
			await access(
				path.dirname(instanceConfig.secrets.localEncrypted.keyFilePath),
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("formats onboard checks", () => {
		const output = formatOnboardChecks([
			{ name: "Config", status: "pass", message: "ok" },
			{ name: "Codex", status: "fail", message: "missing" },
		]);
		expect(output).toContain("Summary");
		expect(output).toContain("1 passed");
		expect(output).toContain("1 failed");
		expect(output).toContain("Config");
		expect(output).toContain("Codex");
		expect(output).toContain("1 check failed");
	});

	it("reports successful minimal onboard checks", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks.every((check) => check.status === "pass")).toBe(true);
		expect(checks).toContainEqual({
			name: "JWT secret",
			status: "pass",
			message: "present",
		});
		expect(checks).toContainEqual({
			name: "LLM provider",
			status: "pass",
			message: "configured: codex",
		});
		expect(checks).toContainEqual({
			name: "Server port",
			status: "pass",
			message: "127.0.0.1:3100 is available",
		});
	});

	it("passes workspace-level onboard checks when no projects exist", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () => ({
					...loadedConfig({ linearApiKey: "lin_secret_123" }),
					projects: [],
				}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks.every((check) => check.status === "pass")).toBe(true);
		expect(checks.map((check) => check.name)).not.toContain(
			`Execution path (${checkProjectId})`,
		);
		expect(checks.map((check) => check.name)).not.toContain("Linear API key");
	});

	it("passes instance onboard checks without a workspace config file", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () => ({
					...loadedConfig({ linearApiKey: "lin_secret_123" }),
					projects: [],
				}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "Instance config",
			status: "pass",
			message: "instance config loaded successfully",
		});
		expect(checks.every((check) => check.status === "pass")).toBe(true);
	});

	it("reports targeted instance doctor failures when instance config is missing or malformed", async () => {
		const missingInstanceMessage = `${instanceConfigPath()} missing or inaccessible`;
		const missingChecks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
				loadInstanceConfig: async () => ({
					ok: false,
					message: missingInstanceMessage,
				}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(missingChecks).toContainEqual({
			name: "Instance config",
			status: "fail",
			message: missingInstanceMessage,
		});
		expect(missingChecks).toContainEqual({
			name: "Storage",
			status: "fail",
			message: `instance config unavailable: ${missingInstanceMessage}`,
		});

		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-onboard-test-"),
		);
		try {
			await mkdir(path.dirname(instanceConfigPath()), { recursive: true });
			await writeFile(instanceConfigPath(), "{nope");
			const malformed = await loadInstanceConfig(tempDir);
			expect(malformed.ok).toBe(false);
			if (!malformed.ok) {
				expect(malformed.message).toContain("is malformed");
			}
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("reports storage, database, log directory, and server port failure paths", async () => {
		const config = createInstanceConfig(
			"/tmp/demo",
			"2026-05-12T16:13:11.419Z",
		);
		config.database.embeddedPostgresPort = 0;
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
				loadInstanceConfig: async () => ({ ok: true, config }),
				access: async () => {},
				readFile: async () => "",
				mkdir: async (targetPath) => {
					if (targetPath.includes("storage") || targetPath.includes("logs")) {
						throw new Error("permission denied");
					}
					return undefined;
				},
				canBindPort: async () => false,
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "Storage",
			status: "fail",
			message: `storage.localDisk.baseDir ${path.join(
				devosHomeInstanceRoot(),
				"data",
				"storage",
			)} is not accessible: permission denied`,
		});
		expect(checks).toContainEqual({
			name: "Database",
			status: "fail",
			message: "embedded postgres port 0 is invalid",
		});
		expect(checks).toContainEqual({
			name: "Log directory",
			status: "fail",
			message: `logging.logDir ${path.join(
				devosHomeInstanceRoot(),
				"logs",
			)} is not accessible: permission denied`,
		});
		expect(checks).toContainEqual({
			name: "Server port",
			status: "fail",
			message: "127.0.0.1:3100 is already in use",
		});
	});

	it("reports configured LLM provider backends", async () => {
		const claudeChecks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({
						linearApiKey: "lin_secret_123",
						agentBackend: "claude-code",
					}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(claudeChecks).toContainEqual({
			name: "LLM provider",
			status: "pass",
			message: "configured: claude-code",
		});
	});

	it("reports cursor agent provider and binary failures", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({
						linearApiKey: "lin_secret_123",
						agentBackend: "cursor-agent",
					}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async (command) =>
					command === "cursor-agent"
						? {
								code: 1,
								stdout: "",
								stderr: "command not found: cursor-agent",
							}
						: okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "LLM provider",
			status: "pass",
			message: "configured: cursor-agent",
		});
		expect(checks).toContainEqual({
			name: "Cursor Agent binary",
			status: "fail",
			message:
				"cursor-agent binary not found. Install Cursor Agent CLI and run: cursor-agent login",
		});
	});

	it("reports custom cursor agent binary failures with the configured binary", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({
						linearApiKey: "lin_secret_123",
						agentBackend: "cursor-agent",
						cursorBinary: "custom-cursor-agent",
					}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async (command) =>
					command === "custom-cursor-agent"
						? {
								code: 1,
								stdout: "",
								stderr: "command not found: custom-cursor-agent",
							}
						: okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "Cursor Agent binary",
			status: "fail",
			message:
				"custom-cursor-agent binary not found. Install Cursor Agent CLI and run: cursor-agent login",
		});
	});

	it("passes onboard checks without tracker API keys", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () => loadedConfig({}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks.every((check) => check.status === "pass")).toBe(true);
	});

	it("reports missing execution path", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
				access: async () => {
					throw new Error("missing");
				},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "Execution path (demo-project)",
			status: "fail",
			message: "/tmp/demo does not exist or is not accessible",
		});
	});

	it("reports missing skill files", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
				access: async (targetPath) => {
					if (targetPath === "/tmp/demo/skills/piv-implement/SKILL.md") {
						throw new Error("missing");
					}
				},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "Skill file (demo-project:implement)",
			status: "fail",
			message:
				"/tmp/demo/skills/piv-implement/SKILL.md does not exist or is not accessible",
		});
	});

	it("reports missing auto-select database when database source is enabled", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
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
			}),
		);

		expect(checks).toContainEqual({
			name: "Skill auto-select database (demo-project)",
			status: "fail",
			message: "/tmp/demo/skills.db does not exist or is not accessible",
		});
	});

	it("reports missing rtk binary", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
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
			}),
		);

		expect(checks).toContainEqual({
			name: "RTK binary",
			status: "fail",
			message:
				"rtk binary not found. Install from: https://github.com/rtk-ai/rtk",
		});
	});

	it("reports missing docker binary when codex docker is enabled", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
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
			}),
		);

		expect(checks).toContainEqual({
			name: "Docker binary",
			status: "fail",
			message:
				"docker unavailable for codex.docker.enabled projects: command not found: docker",
		});
	});

	it("skips host codex check when only docker-backed codex projects are configured", async () => {
		const checks = await collectOnboardChecks(
			"/tmp/demo",
			onboardCheckDeps({
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
			}),
		);

		expect(
			checks.find((check) => check.name === "Codex binary"),
		).toBeUndefined();
		expect(checks).toContainEqual({
			name: "Docker binary",
			status: "pass",
			message: "docker is available",
		});
	});

	it("renders onboard rtk install prompt", () => {
		expect(renderOnboardRtkInstallPrompt()).toContain(
			"Install RTK before running workflows: https://github.com/rtk-ai/rtk",
		);
	});

	it("renders onboard github install prompt", () => {
		expect(renderOnboardGitHubInstallPrompt()).toContain(
			"Then authenticate: gh auth login",
		);
	});
});

function loadedConfig({
	dockerEnabled = false,
	agentBackend,
	cursorApiKey,
	cursorBinary = "cursor-agent",
}: {
	linearApiKey?: string;
	dockerEnabled?: boolean;
	agentBackend?: "codex" | "claude-code" | "cursor-agent";
	cursorApiKey?: string;
	cursorBinary?: string;
}): LoadedConfig {
	return {
		projects: [
			{
				id: checkProjectId,
				name: checkProjectName,
				workspacePath: draft.workspacePath,
				executionPath: draft.executionPath,
				repo: {
					owner: checkRepoOwner,
					name: checkRepoName,
					baseBranch: checkBaseBranch,
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
				cursor: {
					binary: cursorBinary,
					apiKey: cursorApiKey,
					streamLogs: false,
				},
				github: {
					useGhCli: true,
					defaultBugLabel: "bug",
				},
				server: {
					database: {
						databasePath: "/tmp/demo/.devos/config/server-db",
						port: 54329,
					},
				},
				workflow: {
					issueConcurrency: 1,
				},
				...(agentBackend ? { agent: { backend: agentBackend } } : {}),
				dryRun: false,
				skills: {
					root: "/tmp/demo/skills",
					brainstorm: "/tmp/demo/skills/piv-brainstorm/SKILL.md",
					plan: "/tmp/demo/skills/piv-plan/SKILL.md",
					implement: "/tmp/demo/skills/piv-implement/SKILL.md",
					reviewTest: "/tmp/demo/skills/piv-review-test/SKILL.md",
					githubComment: "/tmp/demo/skills/piv-github-comment/SKILL.md",
				},
			},
		],
		server: {
			database: {
				databasePath: "/tmp/demo/.devos/config/server-db",
				port: 54329,
			},
		},
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
		workspace: {
			id: "owner-1",
			name: "Default Workspace",
		},
	};
}

function createTestDraft(): OnboardDraft {
	return {
		workspaceName: "Demo Workspace",
		workspacePath: "/tmp/demo",
		executionPath: "/tmp/demo",
		instance: createDefaultOnboardInstanceDraft(),
		notifications: {
			email: {
				enabled: true,
				resendApiKey: "re_secret_123",
				from: "devos@example.com",
				to: ["alerts@example.com", "ops@example.com"],
			},
		},
		workflow: {
			isolatedWorktrees: true,
		},
		statusMap: DEFAULT_STATUS_MAP,
		labelMap: DEFAULT_LABEL_MAP,
		codex: {
			reasoningEfforts: {
				brainstorm: "high",
				plan: "medium",
				implement: "low",
				reviewTest: "medium",
				githubComment: "medium",
			},
			models: {
				brainstorm: "gpt-5.5",
				plan: "gpt-5.5",
				implement: "gpt-5.3-codex",
				reviewTest: "gpt-5.3-codex",
				githubComment: "gpt-5.3-codex",
			},
			plugins: ["github@openai-curated"],
			skillsets: ["devos"],
			configOverrides: {
				"features.codex_hooks": "true",
			},
			sandbox: "workspace-write",
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

function onboardCheckDeps(overrides: OnboardCheckDeps = {}): OnboardCheckDeps {
	return {
		loadResolvedEnv: async () => ({ JWT_SECRET: "present" }),
		loadInstanceConfig: async () => ({
			ok: true,
			config: createInstanceConfig("/tmp/demo", "2026-05-12T16:13:11.419Z"),
		}),
		mkdir: async () => undefined,
		canBindPort: async () => true,
		...overrides,
	};
}

async function captureStdout(run: () => Promise<void>): Promise<string> {
	const previousWrite = process.stdout.write;
	let output = "";
	process.stdout.write = ((chunk: string | Uint8Array) => {
		output += String(chunk);
		return true;
	}) as typeof process.stdout.write;
	try {
		await run();
		return output;
	} finally {
		process.stdout.write = previousWrite;
	}
}

function onboardingPromptAdapter(): PromptAdapter {
	return promptAdapter({
		text: {
			"Workspace name": "Demo Workspace",
		},
	});
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
