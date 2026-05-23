import { describe, expect, it, mock } from "bun:test";
import {
	access,
	mkdir,
	mkdtemp,
	readFile,
	rm,
	writeFile,
} from "node:fs/promises";
import path from "node:path";
import {
	boardProjectsTable,
	eq,
	initializeServerDatabase,
	projectBoardsTable,
} from "devos-db";
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
	LOCAL_BOARD_ID,
	LOCAL_WORKSPACE_ID,
	type SetupCheckDeps,
	type SetupDraft,
	collectSetupChecks,
	collectSetupDraft,
	createInstanceConfig,
	formatSetupChecks,
	loadInstanceConfig,
	mergeEnvFile,
	normalizeProjectId,
	renderDevosBanner,
	renderEnvFile,
	renderInstanceConfig,
	renderSetupGitHubInstallPrompt,
	renderSetupRtkInstallPrompt,
	runSetupWizard,
	writeSetupFiles,
} from "../src/features/setup";
import type { CommandResult } from "../src/utils/shell";

const draft: SetupDraft = {
	workspaceName: "Demo Workspace",
	workspacePath: "/tmp/demo",
	executionPath: "/tmp/demo",
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
const checkProjectId = "demo-project";
const checkProjectName = "Demo Project";
const checkRepoOwner = "octo";
const checkRepoName = "demo";
const checkBaseBranch = "main";

describe("setup helpers", () => {
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
		expect(env).not.toContain("lin_secret_123");
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

	it("exports the Linear API key settings URL", () => {
		expect(LINEAR_API_KEY_SETTINGS_URL).toBe(
			"https://linear.app/settings/account/security",
		);
	});

	it("maps typed onboarding prompts into the setup draft", async () => {
		const previousLinearApiKey = process.env.LINEAR_API_KEY;
		process.env.LINEAR_API_KEY = "lin_secret_123";
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
		try {
			const draft = await collectSetupDraft("/tmp/demo", {
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
			expect(draft.linearApiKey).toBe("lin_secret_123");
			expect(draft.notifications.email).toEqual({
				enabled: false,
				to: [],
			});
			expect(draft.statusMap).toEqual(DEFAULT_STATUS_MAP);
			expect(draft.codex.sandbox).toBe("workspace-write");
			expect(draft.codex.reasoningEfforts).toMatchObject({
				plan: "low",
				implement: "low",
				reviewTest: "medium",
				githubComment: "medium",
			});
			expect(draft.codex.plugins).toEqual([
				"github@openai-curated",
				"linear@openai-curated",
			]);
			expect(textPrompts).toEqual(["Workspace name"]);
		} finally {
			if (previousLinearApiKey === undefined) {
				process.env.LINEAR_API_KEY = undefined;
			} else {
				process.env.LINEAR_API_KEY = previousLinearApiKey;
			}
		}
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

	it("runs post-onboard doctor after writing files and keeps JWT secret out of output", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-test-"));
		const collectChecks = mock(async (cwd: string) => {
			const sqliteEnv = await loadSqliteEnv(cwd);
			expect(sqliteEnv?.JWT_SECRET).toBeTruthy();
			return [{ name: "Config file", status: "pass" as const, message: "ok" }];
		});
		try {
			const output = await captureStdout(() =>
				runSetupWizard(tempDir, {
					runCommand: async () => okCommand(),
					prompts: onboardingPromptAdapter(),
					collectSetupChecks: collectChecks,
				}),
			);
			const sqliteEnv = await loadSqliteEnv(tempDir);
			const jwtSecret = sqliteEnv?.JWT_SECRET ?? "missing JWT_SECRET";
			expect(collectChecks).toHaveBeenCalledTimes(1);
			expect(output).toContain("Onboarding files written:");
			expect(output).toContain(
				`Instance config: ${path.join(
					tempDir,
					".devos/config/instance.config.json",
				)}`,
			);
			expect(output).toContain(renderDevosBanner());
			expect(output).toContain("Running doctor checks...\n");
			expect(output).toContain("Summary");
			expect(output).toContain("1 passed");
			expect(output).toContain("Config file");
			expect(output).toContain("ok");
			expect(output).toContain("All checks passed!");
			expect(output).not.toContain(jwtSecret);

			const successIndex = output.indexOf("Onboarding files written:");
			const bannerIndex = output.indexOf(renderDevosBanner());
			const doctorIndex = output.indexOf("Running doctor checks...");
			const resultsIndex = output.indexOf("Config file");
			expect(successIndex).toBeLessThan(bannerIndex);
			expect(bannerIndex).toBeLessThan(doctorIndex);
			expect(doctorIndex).toBeLessThan(resultsIndex);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("merges env updates without dropping unrelated values", () => {
		const merged = mergeEnvFile("KEEP_ME=yes\nLINEAR_API_KEY=old\n", {
			LINEAR_API_KEY: "new secret",
		});
		expect(merged).toContain("KEEP_ME=yes");
		expect(merged).toContain('LINEAR_API_KEY="new secret"');
		expect(merged).not.toContain("LINEAR_API_KEY=old");
	});

	it("preserves existing Linear API key when onboarding has no env key", () => {
		const merged = mergeEnvFile("LINEAR_API_KEY=old\nKEEP_ME=yes\n", {
			LINEAR_API_KEY: undefined,
			JWT_SECRET: "jwt",
		});

		expect(merged).toContain("LINEAR_API_KEY=old");
		expect(merged).toContain("KEEP_ME=yes");
		expect(merged).toContain("JWT_SECRET=jwt");
	});

	it("writes integration values to sqlite and workspace board metadata to server DB", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-test-"));
		try {
			await writeSetupFiles(tempDir, draft);
			const sqliteEnv = await loadSqliteEnv(tempDir);
			expect(sqliteEnv?.LINEAR_API_KEY).toBe("lin_secret_123");
			expect(sqliteEnv?.GITHUB_REPO_OWNER).toBeUndefined();
			expect(sqliteEnv?.GITHUB_REPO_NAME).toBeUndefined();
			expect(sqliteEnv?.GITHUB_BASE_BRANCH).toBeUndefined();
			expect(sqliteEnv?.RESEND_API_KEY).toBe("re_secret_123");
			expect(sqliteEnv?.JWT_SECRET).toMatch(/^[A-Za-z0-9_-]+$/);
			expect(sqliteEnv?.JWT_SECRET?.length).toBeGreaterThan(40);

			const database = await initializeServerDatabase(
				path.join(tempDir, ".devos", "config", "server-db"),
			);
			try {
				const [board] = await database.db
					.select()
					.from(projectBoardsTable)
					.where(eq(projectBoardsTable.id, LOCAL_BOARD_ID));
				expect(board).toMatchObject({
					id: LOCAL_BOARD_ID,
					name: draft.workspaceName,
					ownerId: LOCAL_WORKSPACE_ID,
				});
				const projects = await database.db.select().from(boardProjectsTable);
				expect(projects).toHaveLength(0);
			} finally {
				await database.close();
			}

			const envPath = path.join(tempDir, ".env");
			const envContent = await readFile(envPath, "utf8");
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

	it("formats setup checks", () => {
		const output = formatSetupChecks([
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

	it("reports successful minimal setup checks", async () => {
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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

	it("passes workspace-level setup checks when no projects exist", async () => {
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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

	it("reports targeted instance doctor failures when instance config is missing or malformed", async () => {
		const missingChecks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
				loadInstanceConfig: async () => ({
					ok: false,
					message: ".devos/config/instance.config.json missing or inaccessible",
				}),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(missingChecks).toContainEqual({
			name: "Config file",
			status: "fail",
			message: ".devos/config/instance.config.json missing or inaccessible",
		});
		expect(missingChecks).toContainEqual({
			name: "Storage",
			status: "fail",
			message:
				"instance config unavailable: .devos/config/instance.config.json missing or inaccessible",
		});

		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-test-"));
		try {
			await mkdir(path.join(tempDir, ".devos/config"), { recursive: true });
			await writeFile(
				path.join(tempDir, ".devos/config/instance.config.json"),
				"{nope",
			);
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
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
			message:
				"storage.localDisk.baseDir /tmp/demo/.devos/instances/default/data/storage is not accessible: permission denied",
		});
		expect(checks).toContainEqual({
			name: "Database",
			status: "fail",
			message: "embedded postgres port 0 is invalid",
		});
		expect(checks).toContainEqual({
			name: "Log directory",
			status: "fail",
			message:
				"logging.logDir /tmp/demo/.devos/instances/default/logs is not accessible: permission denied",
		});
		expect(checks).toContainEqual({
			name: "Server port",
			status: "fail",
			message: "127.0.0.1:3100 is already in use",
		});
	});

	it("reports configured LLM provider backends", async () => {
		const claudeChecks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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

	it("ignores missing Linear API keys in setup checks", async () => {
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
				loadConfig: async () => loadedConfig({ linearApiKey: "" }),
				access: async () => {},
				readFile: async () => "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks.map((check) => check.name)).not.toContain("Linear API key");
		expect(checks.every((check) => check.status === "pass")).toBe(true);
	});

	it("reports missing execution path", async () => {
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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

	it("reports secrets in tracked config", async () => {
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
				loadConfig: async () =>
					loadedConfig({ linearApiKey: "lin_secret_123" }),
				access: async () => {},
				readFile: async (filePath) =>
					filePath.endsWith("devos.config.ts") ? "lin_secret_123" : "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "Tracked config secrets",
			status: "fail",
			message: "devos.config.ts contains a configured secret",
		});
	});

	it("reports cursor api keys in tracked config", async () => {
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
				loadConfig: async () =>
					loadedConfig({
						linearApiKey: "lin_secret_123",
						cursorApiKey: "cursor_secret_123",
					}),
				access: async () => {},
				readFile: async (filePath) =>
					filePath.endsWith("devos.config.ts") ? "cursor_secret_123" : "",
				runCommand: async () => okCommand(),
			}),
		);

		expect(checks).toContainEqual({
			name: "Tracked config secrets",
			status: "fail",
			message: "devos.config.ts contains a configured secret",
		});
	});

	it("reports missing rtk binary", async () => {
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
		const checks = await collectSetupChecks(
			"/tmp/demo",
			setupCheckDeps({
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
	agentBackend,
	cursorApiKey,
	cursorBinary = "cursor-agent",
}: {
	linearApiKey: string;
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
					},
				},
				workflow: {
					issueConcurrency: 1,
				},
				...(agentBackend ? { agent: { backend: agentBackend } } : {}),
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
		server: {
			database: {
				databasePath: "/tmp/demo/.devos/config/server-db",
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
	};
}

function okCommand(): CommandResult {
	return {
		code: 0,
		stdout: "ok",
		stderr: "",
	};
}

function setupCheckDeps(overrides: SetupCheckDeps = {}): SetupCheckDeps {
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
