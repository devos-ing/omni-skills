import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { loadConfig } from "../src/config";

const envKeys = [
	"LINEAR_API_KEY",
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
		expect(config.projects[0]?.linear.statusMap.assigned).toBe(
			"linear_status_assigned",
		);
		expect(config.projects[0]?.executionPath).toBe("piv_execution_path");
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
});
