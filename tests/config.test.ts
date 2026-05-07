import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadConfig } from "../src/config";

const envKeys = [
	"LINEAR_API_KEY",
	"LINEAR_PROJECT_ID",
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
	"CODEX_MODEL_PLAN",
	"CODEX_MODEL_IMPLEMENT",
	"CODEX_MODEL_REVIEW_TEST",
	"PIV_DEV_MODE",
	"PIV_PRINT_CODEX_LOGS",
	"PIV_POLL_INTERVAL_MS",
	"PIV_MAX_POLL_CYCLES",
	"PIV_EXIT_WHEN_IDLE",
	"PIV_STALE_RUN_TIMEOUT_MS",
] as const;

const previousEnv: Record<string, string | undefined> = {};

describe("loadConfig", () => {
	beforeEach(() => {
		for (const key of envKeys) {
			previousEnv[key] = process.env[key];
			process.env[key] =
				key === "CODEX_SANDBOX"
					? "workspace-write"
					: key === "CODEX_HOME"
						? ""
						: key === "PIV_POLL_INTERVAL_MS"
							? "30000"
							: key === "PIV_MAX_POLL_CYCLES"
								? ""
								: key === "PIV_DEV_MODE" || key === "PIV_PRINT_CODEX_LOGS"
									? "0"
									: key === "PIV_EXIT_WHEN_IDLE"
										? "1"
										: key === "PIV_STALE_RUN_TIMEOUT_MS"
											? "3600000"
											: key.toLowerCase();
		}
	});

	afterEach(() => {
		for (const key of envKeys) {
			process.env[key] = previousEnv[key];
		}
	});

	it("loads required env values", async () => {
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.linear.apiKey).toBe("linear_api_key");
		expect(config.projects[0]?.linear.projectId).toBe("linear_project_id");
		expect(config.projects[0]?.linear.statusMap.assigned).toBe(
			"linear_status_assigned",
		);
		expect(config.projects[0]?.executionPath).toBe("piv_execution_path");
		expect(config.polling.intervalMs).toBe(30000);
		expect(config.polling.maxCycles).toBeUndefined();
		expect(config.polling.exitWhenIdle).toBe(true);
		expect(config.polling.staleRunTimeoutMs).toBe(3600000);
	});

	it("loads polling values from env", async () => {
		process.env.PIV_POLL_INTERVAL_MS = "15000";
		process.env.PIV_MAX_POLL_CYCLES = "20";
		process.env.PIV_EXIT_WHEN_IDLE = "0";
		process.env.PIV_STALE_RUN_TIMEOUT_MS = "600000";
		const config = await loadConfig(process.cwd());
		expect(config.polling.intervalMs).toBe(15000);
		expect(config.polling.maxCycles).toBe(20);
		expect(config.polling.exitWhenIdle).toBe(false);
		expect(config.polling.staleRunTimeoutMs).toBe(600000);
	});

	it("rejects non-positive stale run timeout", async () => {
		process.env.PIV_STALE_RUN_TIMEOUT_MS = "0";
		await expect(loadConfig(process.cwd())).rejects.toThrow(
			"Polling stale run timeout must be a positive integer",
		);
	});

	it("rejects project-level polling overrides", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		await writeFile(
			path.join(tempDir, "piv-loop.config.ts"),
			[
				"export default {",
				"  projects: [",
				"    {",
				"      id: 'default',",
				"      polling: { intervalMs: 12345 }",
				"    }",
				"  ]",
				"};",
				"",
			].join("\n"),
		);

		try {
			await expect(loadConfig(tempDir)).rejects.toThrow(
				"Project-level polling config is not supported",
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("disables codex sandbox by default", async () => {
		process.env.CODEX_SANDBOX = undefined;
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.codex.sandbox).toBeUndefined();
	});

	it("enables codex sandbox when configured", async () => {
		process.env.CODEX_SANDBOX = "read-only";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.codex.sandbox).toBe("read-only");
	});

	it("uses codex cli default home unless CODEX_HOME is set", async () => {
		process.env.CODEX_HOME = "";
		const defaultConfig = await loadConfig(process.cwd());
		expect(defaultConfig.projects[0]?.codex.codexHome).toBeUndefined();

		process.env.CODEX_HOME = "/tmp/custom-codex-home";
		const overrideConfig = await loadConfig(process.cwd());
		expect(overrideConfig.projects[0]?.codex.codexHome).toBe(
			"/tmp/custom-codex-home",
		);
	});

	it("loads stage-specific codex models from env", async () => {
		process.env.CODEX_MODEL_PLAN = "gpt-5.5";
		process.env.CODEX_MODEL_IMPLEMENT = "gpt-5.3-codex";
		process.env.CODEX_MODEL_REVIEW_TEST = "gpt-5.3-codex";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.codex.models?.plan).toBe("gpt-5.5");
		expect(config.projects[0]?.codex.models?.implement).toBe("gpt-5.3-codex");
		expect(config.projects[0]?.codex.models?.reviewTest).toBe("gpt-5.3-codex");
	});

	it("does not stream codex logs by default", async () => {
		process.env.PIV_DEV_MODE = "0";
		process.env.PIV_PRINT_CODEX_LOGS = "0";
		const config = await loadConfig(process.cwd());
		expect(config.projects[0]?.codex.streamLogs).toBe(false);
	});

	it("streams codex logs when enabled by env", async () => {
		process.env.PIV_DEV_MODE = "1";
		const configFromDevMode = await loadConfig(process.cwd());
		expect(configFromDevMode.projects[0]?.codex.streamLogs).toBe(true);

		process.env.PIV_DEV_MODE = "0";
		process.env.PIV_PRINT_CODEX_LOGS = "1";
		const configFromLegacyFlag = await loadConfig(process.cwd());
		expect(configFromLegacyFlag.projects[0]?.codex.streamLogs).toBe(true);
	});

	it("supports codex plugins and skillsets in project config", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		await writeFile(
			path.join(tempDir, "piv-loop.config.ts"),
			[
				"export default {",
				"  codex: {",
				"    plugins: ['github@openai-curated'],",
				"    skillsets: ['default-skillset'],",
				"    configOverrides: {",
				"      'features.root': 'true'",
				"    }",
				"  },",
				"  projects: [",
				"    {",
				"      id: 'default',",
				"      codex: {",
				"        plugins: ['linear@openai-curated'],",
				"        configOverrides: {",
				"          'features.project': 'false'",
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
			expect(config.projects[0]?.codex.plugins).toEqual([
				"linear@openai-curated",
			]);
			expect(config.projects[0]?.codex.skillsets).toEqual(["default-skillset"]);
			expect(config.projects[0]?.codex.configOverrides).toEqual({
				"features.project": "false",
			});
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
