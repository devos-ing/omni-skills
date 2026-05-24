import { describe, expect, it } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
	normalizePluginId,
	parseScaffoldArgs,
	scaffoldDevosPlugin,
} from "../src";

describe("create-devos-plugin scaffold", () => {
	it("normalizes names to bounded kebab-case", () => {
		expect(normalizePluginId("My Slack Plugin!")).toBe("my-slack-plugin");
		expect(() => normalizePluginId("   ")).toThrow("Plugin name");
	});

	it("renders a skill template with manifest and files", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-create-plugin-"),
		);
		try {
			const result = await scaffoldDevosPlugin({
				name: "Docs Helper",
				outputDir: tempDir,
				template: "skill",
				displayName: "Docs Helper",
				description: "Helps agents write docs.",
			});

			expect(result.pluginId).toBe("docs-helper");
			expect(result.manifest.skills[0]?.path).toBe(
				"skills/docs-helper/SKILL.md",
			);
			const manifest = JSON.parse(
				await readFile(
					path.join(result.pluginPath, "devos.plugin.json"),
					"utf8",
				),
			);
			expect(manifest.name).toBe("Docs Helper");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("supports named presets", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-create-plugin-"),
		);
		try {
			const codegraph = await scaffoldDevosPlugin({
				name: "codegraph",
				outputDir: tempDir,
				preset: "codegraph",
			});
			expect(codegraph.manifest.mcpServers[0]).toMatchObject({
				command: "codegraph",
				args: ["serve", "--mcp"],
			});

			const slack = await scaffoldDevosPlugin({
				name: "slack",
				outputDir: tempDir,
				preset: "slack",
			});
			expect(slack.manifest.credentials[0]?.key).toBe("SLACK_BOT_TOKEN");
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("requires force before replacing an existing plugin", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-create-plugin-"),
		);
		try {
			await scaffoldDevosPlugin({ name: "again", outputDir: tempDir });
			await expect(
				scaffoldDevosPlugin({ name: "again", outputDir: tempDir }),
			).rejects.toThrow("already exists");
			await expect(
				scaffoldDevosPlugin({ name: "again", outputDir: tempDir, force: true }),
			).resolves.toMatchObject({ pluginId: "again" });
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

describe("create-devos-plugin args", () => {
	it("parses json output and template options", () => {
		expect(
			parseScaffoldArgs([
				"telegram",
				"--template",
				"connector",
				"--output",
				"/tmp/plugins",
				"--json",
			]),
		).toMatchObject({
			name: "telegram",
			template: "connector",
			outputDir: "/tmp/plugins",
			json: true,
		});
	});
});
