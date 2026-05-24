import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { instanceConfigPath, loadConfig } from "../src/features/config";
import {
	createInstanceConfig,
	renderInstanceConfigDocument,
} from "../src/features/setup";

let previousHome: string | undefined;
let testHomeDir: string | undefined;

describe("plugin config resolution", () => {
	beforeEach(async () => {
		previousHome = process.env.HOME;
		testHomeDir = await mkdtemp(path.join(process.cwd(), ".tmp-config-home-"));
		process.env.HOME = testHomeDir;
		process.env.CODEX_SANDBOX = "workspace-write";
	});

	afterEach(async () => {
		process.env.HOME = previousHome;
		if (testHomeDir) {
			await rm(testHomeDir, { recursive: true, force: true });
		}
	});

	it("loads enabled plugin skills and MCP servers from instance config", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-config-test-"),
		);
		const pluginSkillPath = path.join(tempDir, "plugins", "slack", "SKILL.md");
		const instanceConfig = createInstanceConfig(
			tempDir,
			"2026-05-24T00:00:00.000Z",
		);
		instanceConfig.plugins = {
			installed: [
				{
					id: "slack",
					sourcePath: path.join(tempDir, "plugins", "slack"),
					enabled: true,
					manifest: {
						schemaVersion: 1,
						id: "slack",
						name: "Slack",
						version: "0.1.0",
						description: "Slack connector",
						category: "Connector",
						skills: [{ name: "slack", path: "skills/slack/SKILL.md" }],
						mcpServers: [],
						credentials: [],
						checks: [],
					},
					credentials: { SLACK_BOT_TOKEN: "xoxb-secret" },
					skills: [{ name: "slack", path: pluginSkillPath }],
					mcpServers: [
						{
							name: "slack",
							command: "bun",
							args: ["run", "src/worker.ts"],
							env: { SLACK_BOT_TOKEN: "${SLACK_BOT_TOKEN}" },
						},
					],
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
			const config = await loadConfig(tempDir);

			expect(config.projects[0]?.skills.pluginSkillPaths).toContain(
				pluginSkillPath,
			);
			expect(config.projects[0]?.codex.mcpServers).toContainEqual({
				name: "slack",
				command: "bun",
				args: ["run", "src/worker.ts"],
				env: { SLACK_BOT_TOKEN: "xoxb-secret" },
			});
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
