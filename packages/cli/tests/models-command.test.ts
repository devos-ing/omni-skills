import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { instanceConfigPath } from "../src/features/config";
import { handleModelsCommand } from "../src/features/models/model-command";
import {
	createInstanceConfig,
	loadInstanceConfig,
	renderInstanceConfigDocument,
} from "../src/features/onboard";

let previousHome: string | undefined;
let testHomeDir: string | undefined;

describe("models command", () => {
	beforeEach(async () => {
		previousHome = process.env.HOME;
		testHomeDir = await mkdtemp(path.join(process.cwd(), ".tmp-models-home-"));
		process.env.HOME = testHomeDir;
	});

	afterEach(async () => {
		process.env.HOME = previousHome;
		const homeDir = testHomeDir;
		previousHome = undefined;
		testHomeDir = undefined;
		if (homeDir) {
			await rm(homeDir, { recursive: true, force: true });
		}
	});

	it("writes stage model and reasoning settings into instance config", async () => {
		await writeInstanceConfig();

		await handleModelsCommand(
			{
				action: "set",
				stage: "plan",
				model: "gpt-5.5",
				reasoningEffort: "high",
			},
			"/tmp/project",
			{ write: () => {} },
		);

		const loaded = await loadInstanceConfig("/tmp/project");
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(loaded.config.codex?.models?.plan).toBe("gpt-5.5");
		expect(loaded.config.codex?.reasoningEfforts?.plan).toBe("high");
	});

	it("lists brainstorm model and reasoning settings", async () => {
		await writeInstanceConfig({
			codex: {
				models: { brainstorm: "gpt-5.4-mini" },
				reasoningEfforts: { brainstorm: "xhigh" },
			},
		});
		let output = "";

		await handleModelsCommand({ action: "list" }, "/tmp/project", {
			write: (message) => {
				output += message;
			},
		});

		expect(output).toContain("brainstorm\tgpt-5.4-mini\txhigh");
	});

	it("clears one stage without removing other stage settings", async () => {
		await writeInstanceConfig({
			codex: {
				models: { plan: "gpt-5.5", implement: "gpt-5.3-codex" },
				reasoningEfforts: { plan: "high", implement: "medium" },
			},
		});

		await handleModelsCommand(
			{ action: "reset", stage: "plan" },
			"/tmp/project",
			{ write: () => {} },
		);

		const loaded = await loadInstanceConfig("/tmp/project");
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(loaded.config.codex?.models?.plan).toBeUndefined();
		expect(loaded.config.codex?.models?.implement).toBe("gpt-5.3-codex");
		expect(loaded.config.codex?.reasoningEfforts?.plan).toBeUndefined();
		expect(loaded.config.codex?.reasoningEfforts?.implement).toBe("medium");
	});
});

async function writeInstanceConfig(
	overrides: Record<string, unknown> = {},
): Promise<void> {
	const config = {
		...createInstanceConfig("/tmp/project", "2026-05-29T00:00:00.000Z"),
		...overrides,
	};
	await mkdir(path.dirname(instanceConfigPath()), { recursive: true });
	await writeFile(instanceConfigPath(), renderInstanceConfigDocument(config));
}
