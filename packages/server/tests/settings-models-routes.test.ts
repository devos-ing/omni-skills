import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { instanceConfigPath } from "devos/features/config/home-paths";
import {
	createInstanceConfig,
	loadInstanceConfig,
	renderInstanceConfigDocument,
} from "devos/features/onboard/instance-config";
import { createHandleRequest } from "../src/app";

let previousHome: string | undefined;
let testHomeDir: string | undefined;

describe("settings model routes", () => {
	beforeEach(async () => {
		previousHome = process.env.HOME;
		testHomeDir = await mkdtemp(
			path.join(process.cwd(), ".tmp-settings-home-"),
		);
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

	it("returns persisted workflow model settings with operator stage names", async () => {
		await writeInstanceConfig({
			codex: {
				models: {
					brainstorm: "gpt-5.4-mini",
					plan: "gpt-5.5",
				},
				reasoningEfforts: {
					brainstorm: "xhigh",
					plan: "high",
				},
			},
		});
		const response = await createApp()(
			new Request("http://localhost/api/settings/models"),
		);

		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body).toMatchObject({
			stages: [
				{
					id: "brainstorm",
					label: "Brainstorm",
					model: "gpt-5.4-mini",
					reasoningEffort: "xhigh",
				},
				{ id: "plan", label: "Plan", model: "gpt-5.5" },
				{ id: "implement", label: "Implement" },
				{ id: "testing", label: "Testing" },
			],
			reasoningEfforts: ["low", "medium", "high", "xhigh"],
		});
		expect(body.availableModels).toContainEqual(
			expect.objectContaining({ id: "gpt-5.5", label: "GPT-5.5" }),
		);
	});

	it("updates brainstorm and testing settings in instance config", async () => {
		await writeInstanceConfig();
		const response = await createApp()(
			jsonRequest("PATCH", "/api/settings/models", {
				stages: [
					{
						id: "brainstorm",
						model: "gpt-5.4-mini",
						reasoningEffort: "xhigh",
					},
					{
						id: "testing",
						model: "gpt-5.3-codex",
						reasoningEffort: "medium",
					},
				],
			}),
		);

		expect(response.status).toBe(200);
		const loaded = await loadInstanceConfig("/tmp/project");
		expect(loaded.ok).toBe(true);
		if (!loaded.ok) return;
		expect(loaded.config.codex?.models?.brainstorm).toBe("gpt-5.4-mini");
		expect(loaded.config.codex?.models?.reviewTest).toBe("gpt-5.3-codex");
		expect(loaded.config.codex?.reasoningEfforts?.brainstorm).toBe("xhigh");
		expect(loaded.config.codex?.reasoningEfforts?.reviewTest).toBe("medium");
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

function createApp() {
	return createHandleRequest({
		cliExecutor: {
			execute: async () => ({
				status: "succeeded" as const,
				request: { action: "none" as const },
			}),
			executeStream: async () => ({
				status: "succeeded" as const,
				request: { action: "none" as const },
			}),
			getHistory: () => [],
		},
	});
}

function jsonRequest(method: string, pathname: string, body: unknown): Request {
	return new Request(`http://localhost${pathname}`, {
		method,
		headers: { "content-type": "application/json" },
		body: JSON.stringify(body),
	});
}
