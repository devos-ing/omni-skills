import { describe, expect, it } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { scaffoldDevosPlugin } from "create-devos-plugin";
import type { LoadedConfig } from "../src/features/config";
import { handlePluginsCommand } from "../src/features/plugins";
import { createInstanceConfig } from "../src/features/setup";

const config = {} as LoadedConfig;

describe("runtime plugins", () => {
	it("installs local runtime plugins into instance config", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-plugin-test-"),
		);
		try {
			const scaffold = await scaffoldDevosPlugin({
				name: "CodeGraph",
				outputDir: tempDir,
				preset: "codegraph",
			});
			const instanceConfig = createInstanceConfig(
				tempDir,
				"2026-05-24T00:00:00.000Z",
			);
			const saved: (typeof instanceConfig)[] = [];
			const output = await captureStdout(() =>
				handlePluginsCommand(
					config,
					{ action: "install", pluginId: scaffold.pluginPath },
					tempDir,
					{
						loadInstanceConfig: async () => ({
							ok: true,
							config: instanceConfig,
						}),
						saveInstanceConfig: async (next) => {
							saved.push(structuredClone(next));
						},
					},
				),
			);

			expect(output).toContain("Installed plugin codegraph");
			expect(saved[0]?.plugins?.installed[0]).toMatchObject({
				id: "codegraph",
				sourcePath: scaffold.pluginPath,
				enabled: false,
			});
			expect(saved[0]?.plugins?.installed[0]?.skills[0]?.path).toContain(
				"SKILL.md",
			);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("updates duplicate runtime plugin installs without duplicate entries", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-plugin-test-"),
		);
		try {
			const scaffold = await scaffoldDevosPlugin({
				name: "again",
				outputDir: tempDir,
			});
			const instanceConfig = createInstanceConfig(
				tempDir,
				"2026-05-24T00:00:00.000Z",
			);
			for (let count = 0; count < 2; count += 1) {
				await handlePluginsCommand(
					config,
					{ action: "install", pluginId: scaffold.pluginPath },
					tempDir,
					{
						loadInstanceConfig: async () => ({
							ok: true,
							config: instanceConfig,
						}),
						saveInstanceConfig: async () => undefined,
					},
				);
			}

			expect(instanceConfig.plugins?.installed).toHaveLength(1);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("enables runtime plugins and prompts for credentials", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-plugin-test-"),
		);
		try {
			const scaffold = await scaffoldDevosPlugin({
				name: "slack",
				outputDir: tempDir,
				preset: "slack",
			});
			const instanceConfig = createInstanceConfig(
				tempDir,
				"2026-05-24T00:00:00.000Z",
			);
			await handlePluginsCommand(
				config,
				{ action: "install", pluginId: scaffold.pluginPath },
				tempDir,
				{
					loadInstanceConfig: async () => ({
						ok: true,
						config: instanceConfig,
					}),
					saveInstanceConfig: async () => undefined,
				},
			);

			await captureStdout(() =>
				handlePluginsCommand(
					config,
					{ action: "enable", pluginId: "slack" },
					tempDir,
					{
						loadInstanceConfig: async () => ({
							ok: true,
							config: instanceConfig,
						}),
						saveInstanceConfig: async () => undefined,
						prompts: promptAdapter("xoxb-secret"),
					},
				),
			);

			expect(instanceConfig.plugins?.installed[0]).toMatchObject({
				enabled: true,
				credentials: { SLACK_BOT_TOKEN: "xoxb-secret" },
			});
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("checks runtime plugin commands from the plugin source path", async () => {
		const tempDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-plugin-test-"),
		);
		try {
			const scaffold = await scaffoldDevosPlugin({
				name: "checker",
				outputDir: tempDir,
			});
			const instanceConfig = createInstanceConfig(
				tempDir,
				"2026-05-24T00:00:00.000Z",
			);
			await handlePluginsCommand(
				config,
				{ action: "install", pluginId: scaffold.pluginPath },
				tempDir,
				{
					loadInstanceConfig: async () => ({
						ok: true,
						config: instanceConfig,
					}),
					saveInstanceConfig: async () => undefined,
				},
			);
			const calls: Array<{ command: string; args: string[]; cwd: string }> = [];
			const output = await captureStdout(() =>
				handlePluginsCommand(
					config,
					{ action: "check", pluginId: "checker" },
					tempDir,
					{
						loadInstanceConfig: async () => ({
							ok: true,
							config: instanceConfig,
						}),
						runCommand: async (command, args, options) => {
							calls.push({ command, args, cwd: options.cwd });
							return { code: 0, stdout: "", stderr: "" };
						},
					},
				),
			);

			expect(output).toContain("PASS\tRun plugin tests");
			expect(calls).toEqual([
				{ command: "bun", args: ["test"], cwd: scaffold.pluginPath },
			]);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});

function promptAdapter(passwordValue: string) {
	return {
		text: async () => "",
		password: async () => passwordValue,
		confirm: async () => true,
		select: async <Value extends string>(options: {
			options: Array<{ value: Value }>;
		}) => options.options[0]?.value ?? ("" as Value),
	};
}

async function captureStdout(action: () => Promise<void>): Promise<string> {
	const originalWrite = process.stdout.write;
	let output = "";
	process.stdout.write = ((chunk: string | Uint8Array) => {
		output += chunk.toString();
		return true;
	}) as typeof process.stdout.write;
	try {
		await action();
		return output;
	} finally {
		process.stdout.write = originalWrite;
	}
}
