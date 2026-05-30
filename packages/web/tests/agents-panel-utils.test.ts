import { describe, expect, it } from "bun:test";

import {
	deriveAgentRows,
	filterAgentRows,
	summarizeAgentCounts,
} from "../src/components/agents/agents-panel-utils";
import type { AgentRecord } from "../src/lib/api";

function createAgent(overrides: Partial<AgentRecord>): AgentRecord {
	return {
		id: "agent-1",
		name: "Planner",
		description: "",
		logo: "",
		runtime: "codex-local",
		backend: "codex",
		model: "gpt-5",
		reasoningEffort: "medium",
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

describe("agents panel utilities", () => {
	it("filters agent rows by search text and status", () => {
		const rows = deriveAgentRows([
			createAgent({ id: "planner", name: "PIV Planner" }),
			createAgent({
				id: "reviewer",
				name: "Review Agent",
				owner: "alex",
				status: "offline",
			}),
		]);

		expect(filterAgentRows(rows, "piv", "all").map((row) => row.id)).toEqual([
			"planner",
		]);
		expect(filterAgentRows(rows, "", "offline").map((row) => row.id)).toEqual([
			"reviewer",
		]);
		expect(summarizeAgentCounts(rows)).toEqual({
			all: 2,
			online: 1,
			offline: 1,
		});
	});

	it("derives workload, activity, run count, and model labels", () => {
		const [row] = deriveAgentRows([
			createAgent({
				activity: ["Planning backlog", "Writing tests"],
				concurrency: 3,
				model: "gpt-5.1",
				reasoningEffort: "xhigh",
				recentWork: ["RUN-1", "RUN-2"],
			}),
		]);

		expect(row).toMatchObject({
			activityLabel: "Planning backlog",
			modelLabel: "gpt-5.1",
			reasoningLabel: "Reasoning xhigh",
			runCount: 2,
			workloadLabel: "2 active / 3 capacity",
		});
	});
});
