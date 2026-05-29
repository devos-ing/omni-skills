import { describe, expect, it } from "bun:test";
import { type AgentBackend, createAgentAdapter } from "adapters";
import { ClaudeCodeAdapter } from "adapters/claude";
import { CodexAdapter } from "adapters/codex";
import { CursorAgentAdapter } from "adapters/cursor";
import { OpenCodeAdapter } from "adapters/opencode";
import type { ResolvedProjectConfig } from "../src/features/types";

function createConfig(
	backend?: "codex" | "claude-code" | "cursor-agent" | "opencode",
): ResolvedProjectConfig {
	return {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/work",
		executionPath: "/tmp/work/repo",
		repo: { owner: "o", name: "n", baseBranch: "main" },
		github: { useGhCli: true, defaultBugLabel: "bug" },
		server: {
			database: {
				databasePath: "/tmp/work/.devos/config/server-db",
				port: 54329,
			},
		},
		codex: { binary: process.execPath, streamLogs: false },
		cursor: { binary: "cursor-agent", streamLogs: false },
		opencode: { binary: "opencode", streamLogs: false },
		agent: backend ? { backend } : undefined,
		skills: {
			root: "r",
			brainstorm: "b",
			plan: "p",
			implement: "i",
			reviewTest: "r",
			githubComment: "g",
		},
		workflow: { issueConcurrency: 1 },
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

	it("uses cursor backend from project config", () => {
		const adapter = createAgentAdapter(createConfig("cursor-agent"));
		expect(adapter).toBeInstanceOf(CursorAgentAdapter);
	});

	it("uses opencode backend from project config", () => {
		const adapter = createAgentAdapter(createConfig("opencode"));
		expect(adapter).toBeInstanceOf(OpenCodeAdapter);
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
