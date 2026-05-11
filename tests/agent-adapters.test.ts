import { describe, expect, it } from "bun:test";
import { ClaudeCodeAdapter } from "../src/agent-adapters/claude-code";
import { CodexAdapter } from "../src/agent-adapters/codex";
import {
	type AgentBackend,
	createAgentAdapter,
} from "../src/agent-adapters/index";
import type { ResolvedProjectConfig } from "../src/core/types";

function createConfig(
	backend?: "codex" | "claude-code",
): ResolvedProjectConfig {
	return {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/work",
		executionPath: "/tmp/work/repo",
		repo: { owner: "o", name: "n", baseBranch: "main" },
		linear: {
			apiKey: "x",
			apiUrl: "https://api.linear.app/graphql",
			pollLimit: 10,
			statusMap: {
				backlog: "z",
				assigned: "a",
				planning: "b",
				implementing: "c",
				pr_created: "d",
				reviewing: "e",
				testing: "f",
				blocked: "g",
				done: "h",
			},
			labelMap: {
				pr_created: "PR Created",
				reviewing: "Reviewing",
				testing: "Testing",
			},
			autoCreateLabels: true,
		},
		github: { useGhCli: true, defaultBugLabel: "bug" },
		codex: { binary: process.execPath, streamLogs: false },
		agent: backend ? { backend } : undefined,
		skills: { root: "r", plan: "p", implement: "i", reviewTest: "r" },
		dryRun: false,
	};
}

describe("createAgentAdapter", () => {
	it("defaults to codex when no backend is configured", () => {
		const adapter = createAgentAdapter(createConfig());
		expect(adapter).toBeInstanceOf(CodexAdapter);
	});

	it("uses configured backend from project config", () => {
		const adapter = createAgentAdapter(createConfig("claude-code"));
		expect(adapter).toBeInstanceOf(ClaudeCodeAdapter);
	});

	it("honors explicit backend override", () => {
		const adapter = createAgentAdapter(
			createConfig("claude-code"),
			"codex" satisfies AgentBackend,
		);
		expect(adapter).toBeInstanceOf(CodexAdapter);
	});

	it("throws for unknown backend value", () => {
		expect(() =>
			createAgentAdapter(
				createConfig(),
				"not-a-backend" as unknown as AgentBackend,
			),
		).toThrow("Unknown agent backend: not-a-backend");
	});
});
