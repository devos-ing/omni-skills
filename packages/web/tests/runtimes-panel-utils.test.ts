import { describe, expect, it } from "bun:test";

import {
	deriveRuntimeSummaries,
	formatRuntimeLabel,
} from "../src/components/runtimes/runtimes-panel-utils";
import type { AgentRecord } from "../src/lib/api";

function createAgent(overrides: Partial<AgentRecord>): AgentRecord {
	return {
		id: "agent-1",
		name: "Agent One",
		description: "",
		logo: "",
		runtime: "codex",
		backend: "codex",
		model: "gpt-5",
		reasoningEffort: null,
		status: "online",
		concurrency: 1,
		owner: "roy",
		createdAt: "2026-05-20T00:00:00.000Z",
		updatedAt: "2026-05-20T00:00:00.000Z",
		skills: [],
		recentWork: [],
		activity: [],
		instructions: "",
		...overrides,
	};
}

describe("runtimes panel utilities", () => {
	it("groups agents by runtime and totals capacity", () => {
		const runtimes = deriveRuntimeSummaries([
			createAgent({
				id: "implementer",
				name: "Implementer",
				model: "gpt-5-codex",
				concurrency: 2,
				updatedAt: "2026-05-21T00:00:00.000Z",
			}),
			createAgent({
				id: "reviewer",
				name: "Reviewer",
				model: "gpt-5",
				owner: "alex",
				updatedAt: "2026-05-22T00:00:00.000Z",
			}),
			createAgent({
				id: "planner",
				name: "Planner",
				runtime: "claude_code",
				backend: "claude",
				model: "claude-sonnet-4.5",
				owner: "morgan",
			}),
		]);

		expect(runtimes.map((runtime) => runtime.label)).toEqual([
			"Claude",
			"Codex",
		]);
		expect(runtimes[1]).toMatchObject({
			id: "codex",
			agentCount: 2,
			totalConcurrency: 3,
			models: ["gpt-5", "gpt-5-codex"],
			owners: ["alex", "roy"],
			updatedAt: "2026-05-22T00:00:00.000Z",
		});
		expect(runtimes[1]?.agents.map((agent) => agent.id)).toEqual([
			"implementer",
			"reviewer",
		]);
	});

	it("formats known and custom runtime labels", () => {
		expect(formatRuntimeLabel("open-code")).toBe("OpenCode");
		expect(formatRuntimeLabel("custom_runtime")).toBe("Custom Runtime");
		expect(formatRuntimeLabel(" ")).toBe("Unknown");
	});
});
