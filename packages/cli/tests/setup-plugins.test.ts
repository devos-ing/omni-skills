import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { instanceConfigPath } from "../src/features/config";
import type { PromptAdapter } from "../src/features/prompts";
import {
	createInstanceConfig,
	renderInstanceConfigDocument,
	runSetupWizard,
} from "../src/features/setup";

let previousHome: string | undefined;
let previousLinearApiKey: string | undefined;
let testHomeDir: string | undefined;

describe("setup plugin credentials", () => {
	beforeEach(async () => {
		previousHome = process.env.HOME;
		previousLinearApiKey = process.env.LINEAR_API_KEY;
		testHomeDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-home-"));
		process.env.HOME = testHomeDir;
		process.env.LINEAR_API_KEY = "lin_secret";
	});

	afterEach(async () => {
		process.env.HOME = previousHome;
		process.env.LINEAR_API_KEY = previousLinearApiKey;
		if (testHomeDir) await rm(testHomeDir, { recursive: true, force: true });
	});

	it("prompts for installed plugin credentials and saves raw values", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-test-"));
		const instanceConfig = createInstanceConfig(
			tempDir,
			"2026-05-24T00:00:00.000Z",
		);
		instanceConfig.plugins = {
			installed: [
				{
					id: "slack",
					sourcePath: path.join(tempDir, "plugins", "slack"),
					enabled: false,
					manifest: {
						schemaVersion: 1,
						id: "slack",
						name: "Slack",
						version: "0.1.0",
						description: "Slack connector",
						category: "Connector",
						skills: [],
						mcpServers: [],
						credentials: [
							{
								key: "SLACK_BOT_TOKEN",
								label: "Slack bot token",
								required: true,
								prompt: "Enter Slack bot token",
							},
						],
						checks: [],
					},
					credentials: {},
					skills: [],
					mcpServers: [],
				},
			],
		};
		try {
			await mkdir(path.dirname(instanceConfigPath()), { recursive: true });
			await writeFile(
				instanceConfigPath(),
				renderInstanceConfigDocument(instanceConfig),
				"utf8",
			);

			await runSetupWizard(tempDir, {
				runCommand: async () => ({ code: 0, stdout: "ok", stderr: "" }),
				prompts: promptAdapter(),
				collectSetupChecks: async () => [
					{ name: "Instance config", status: "pass", message: "ok" },
				],
			});

			const saved = JSON.parse(await readFile(instanceConfigPath(), "utf8"));
			expect(saved.plugins.installed[0].credentials).toEqual({
				SLACK_BOT_TOKEN: "xoxb-secret",
			});
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

function promptAdapter(): PromptAdapter {
	return {
		text: async ({ defaultValue }) => defaultValue ?? "Demo Workspace",
		password: async () => "xoxb-secret",
		confirm: async ({ initialValue }) => initialValue ?? false,
		select: async ({ options, initialValue }) =>
			initialValue ?? options[0].value,
	};
}
