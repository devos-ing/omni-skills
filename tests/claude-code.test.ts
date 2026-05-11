import { describe, expect, it } from "bun:test";
import type { AgentResult } from "../src/agent-adapters";
import {
	ClaudeCodeAdapter,
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
	codex: {
		binary: process.execPath,
		streamLogs: false,
	},
	skills: { root: "r", plan: "p", implement: "i", reviewTest: "r" },
	dryRun: false,
};

function createConfig(
	agent?: ResolvedProjectConfig["agent"],
): ResolvedProjectConfig {
	return {
		...baseConfig,
		agent,
	};
}

describe("claude code adapter", () => {
	it("creates adapter instance", () => {
		const adapter = new ClaudeCodeAdapter(createConfig());
		expect(adapter).toBeDefined();
		expect(typeof adapter.runPlan).toBe("function");
		expect(typeof adapter.resume).toBe("function");
		expect(typeof adapter.runReview).toBe("function");
	});

	it("runPlan delegates to runClaude", async () => {
		const adapter = new ClaudeCodeAdapter(createConfig());
		let observedPrompt = "";
		(
			adapter as unknown as {
				runClaude: (prompt: string) => Promise<AgentResult>;
			}
		).runClaude = async (prompt: string) => {
			observedPrompt = prompt;
			return { finalMessage: "ok", stdout: "out", sessionId: "s1" };
		};
		const result = await adapter.runPlan("plan prompt");
		expect(observedPrompt).toBe("plan prompt");
		expect(result).toEqual({
			finalMessage: "ok",
			stdout: "out",
			sessionId: "s1",
		});
	});

	it("runReview delegates to runClaude", async () => {
		const adapter = new ClaudeCodeAdapter(createConfig());
		let observedPrompt = "";
		(
			adapter as unknown as {
				runClaude: (prompt: string) => Promise<AgentResult>;
			}
		).runClaude = async (prompt: string) => {
			observedPrompt = prompt;
			return { finalMessage: "reviewed", stdout: "out" };
		};
		const result = await adapter.runReview("review prompt");
		expect(observedPrompt).toBe("review prompt");
		expect(result).toEqual({
			finalMessage: "reviewed",
			stdout: "out",
		});
	});

	it("resume delegates to runClaudeResume with session id", async () => {
		const adapter = new ClaudeCodeAdapter(createConfig());
		let observedSessionId = "";
		let observedPrompt = "";
		(
			adapter as unknown as {
				runClaudeResume: (
					sessionId: string,
					prompt: string,
				) => Promise<AgentResult>;
			}
		).runClaudeResume = async (sessionId: string, prompt: string) => {
			observedSessionId = sessionId;
			observedPrompt = prompt;
			return { finalMessage: "done", stdout: "out", sessionId: "s2" };
		};
		const result = await adapter.resume("session-1", "implement prompt");
		expect(observedSessionId).toBe("session-1");
		expect(observedPrompt).toBe("implement prompt");
		expect(result).toEqual({
			finalMessage: "done",
			stdout: "out",
			sessionId: "s2",
		});
	});

	it("builds default common args with bypassPermissions", () => {
		const adapter = new ClaudeCodeAdapter(createConfig());
		const args = (
			adapter as unknown as { buildCommonArgs: () => string[] }
		).buildCommonArgs();
		expect(args).toEqual([
			"--output-format",
			"json",
			"--permission-mode",
			"bypassPermissions",
		]);
	});

	it("builds common args with model, maxTurns, allowedTools, and permission mode", () => {
		const adapter = new ClaudeCodeAdapter(
			createConfig({
				model: "claude-sonnet-4-20250514",
				maxTurns: 7,
				allowedTools: ["Bash", "Read", "Edit"],
				permissionMode: "plan",
			}),
		);
		const args = (
			adapter as unknown as { buildCommonArgs: () => string[] }
		).buildCommonArgs();
		expect(args).toEqual([
			"--output-format",
			"json",
			"--permission-mode",
			"plan",
			"--model",
			"claude-sonnet-4-20250514",
			"--max-turns",
			"7",
			"--allowedTools",
			"Bash",
			"Read",
			"Edit",
		]);
	});

	it("skips maxTurns when maxTurns is zero or negative", () => {
		const zeroTurnsAdapter = new ClaudeCodeAdapter(
			createConfig({
				maxTurns: 0,
			}),
		);
		const negativeTurnsAdapter = new ClaudeCodeAdapter(
			createConfig({
				maxTurns: -5,
			}),
		);
		const zeroArgs = (
			zeroTurnsAdapter as unknown as { buildCommonArgs: () => string[] }
		).buildCommonArgs();
		const negativeArgs = (
			negativeTurnsAdapter as unknown as { buildCommonArgs: () => string[] }
		).buildCommonArgs();
		expect(zeroArgs).not.toContain("--max-turns");
		expect(negativeArgs).not.toContain("--max-turns");
	});

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

	it("returns undefined when usage shape is invalid", () => {
		const json = `{"result":"ok","usage":"bad-shape"}`;
		expect(extractUsage(json)).toEqual({
			inputTokens: undefined,
			outputTokens: undefined,
			totalTokens: undefined,
		});
	});
});
