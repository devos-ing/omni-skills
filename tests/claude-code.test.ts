import { describe, expect, it } from "bun:test";
import {
	extractSessionId,
	extractUsage,
} from "../src/agent-adapters/claude-code";
import type { ResolvedProjectConfig } from "../src/core/types";

const baseConfig: ResolvedProjectConfig = {
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
	codex: {
		binary: "codex",
		streamLogs: false,
	},
	skills: { root: "r", plan: "p", implement: "i", reviewTest: "r" },
	dryRun: false,
};

describe("claude code adapter", () => {
	it("extracts session id from json", () => {
		const json = `{"session_id":"abc-123","result":"ok"}`;
		expect(extractSessionId(json)).toBe("abc-123");
	});

	it("extracts session id from camelCase keys", () => {
		const json = `{"sessionId":"def-456","result":"ok"}`;
		expect(extractSessionId(json)).toBe("def-456");
	});

	it("extracts session id from conversation_id", () => {
		const json = `{"conversation_id":"ghi-789","result":"ok"}`;
		expect(extractSessionId(json)).toBe("ghi-789");
	});

	it("returns undefined when session id is missing", () => {
		const json = `{"result":"ok"}`;
		expect(extractSessionId(json)).toBeUndefined();
	});

	it("extracts usage from nested usage object", () => {
		const json = `{"result":"ok","usage":{"input_tokens":120,"output_tokens":30,"total_tokens":150}}`;
		expect(extractUsage(json)).toEqual({
			inputTokens: 120,
			outputTokens: 30,
			totalTokens: 150,
		});
	});

	it("returns undefined when usage is missing", () => {
		const json = `{"result":"ok"}`;
		expect(extractUsage(json)).toBeUndefined();
	});
});
