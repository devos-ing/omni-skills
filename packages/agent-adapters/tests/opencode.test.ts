import { describe, expect, it } from "bun:test";
import type { AgentAdapterRuntimeConfig, AgentResult } from "../src";
import {
	agentConfigurationDoc,
	availableAgentModels,
	createAgentAdapter,
	listAgentBackends,
	normalizeAgentBackend,
} from "../src";
import { OpenCodeAdapter } from "../src/opencode/adapter";
import { mapOpenCodeError } from "../src/opencode/errors";
import {
	extractFinalMessage,
	extractSessionId,
	extractUsage,
} from "../src/opencode/output";

const config: AgentAdapterRuntimeConfig = {
	workspacePath: "/tmp/work",
	executionPath: "/tmp/work/repo",
	codex: {
		binary: "codex",
		streamLogs: false,
	},
	opencode: {
		binary: "opencode",
		streamLogs: false,
	},
};

describe("opencode registry", () => {
	it("creates opencode adapters and publishes registry metadata", () => {
		expect(
			createAgentAdapter({ ...config, agent: { backend: "opencode" } }),
		).toBeInstanceOf(OpenCodeAdapter);
		expect(listAgentBackends().map((definition) => definition.backend)).toEqual(
			["codex", "claude-code", "cursor-agent", "github-copilot", "opencode"],
		);
		expect(normalizeAgentBackend(" OpenCode ")).toBe("opencode");
		expect(availableAgentModels.opencode[0]?.id).toBe(
			"ollama/qwen2.5-coder:32b",
		);
		expect(agentConfigurationDoc.opencode.defaults.model).toBe(
			"ollama/qwen2.5-coder:32b",
		);
	});
});

describe("opencode adapter", () => {
	it("builds new-session and resume command arguments", async () => {
		const adapter = new OpenCodeAdapter({
			...config,
			opencode: {
				binary: "opencode",
				streamLogs: false,
				model: "ollama/qwen2.5-coder:32b",
				agent: "build",
				attach: "http://127.0.0.1:4096",
				dangerouslySkipPermissions: true,
			},
		});
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runOpenCode: (args: string[]) => Promise<AgentResult>;
			}
		).runOpenCode = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};

		await adapter.runPlan("plan prompt");
		await adapter.resume("session-1", "implement prompt");

		expect(calls[0]).toEqual([
			"run",
			"--format",
			"json",
			"--dir",
			"/tmp/work/repo",
			"--model",
			"ollama/qwen2.5-coder:32b",
			"--agent",
			"build",
			"--attach",
			"http://127.0.0.1:4096",
			"--dangerously-skip-permissions",
			"plan prompt",
		]);
		expect(calls[1]).toEqual([
			"run",
			"--format",
			"json",
			"--dir",
			"/tmp/work/repo",
			"--session",
			"session-1",
			"--model",
			"ollama/qwen2.5-coder:32b",
			"--agent",
			"build",
			"--attach",
			"http://127.0.0.1:4096",
			"--dangerously-skip-permissions",
			"implement prompt",
		]);
	});

	it("omits optional args when unset", async () => {
		const adapter = new OpenCodeAdapter(config);
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runOpenCode: (args: string[]) => Promise<AgentResult>;
			}
		).runOpenCode = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};

		await adapter.runReview("review prompt");

		expect(calls[0]).toEqual([
			"run",
			"--format",
			"json",
			"--dir",
			"/tmp/work/repo",
			"review prompt",
		]);
	});

	it("renders structured runAgent prompts and preserves trace context", async () => {
		const adapter = new OpenCodeAdapter(config);
		const calls: { args: string[]; traceId?: string }[] = [];
		(
			adapter as unknown as {
				runOpenCode: (
					args: string[],
					request: { traceId?: string },
				) => Promise<AgentResult>;
			}
		).runOpenCode = async (args, request) => {
			calls.push({ args, traceId: request.traceId });
			return {
				finalMessage: "done",
				stdout: "",
				traceId: request.traceId,
				backend: "opencode",
			};
		};

		const result = await adapter.runAgent({
			role: "planning",
			prompt: "Plan this",
			traceId: "trace-1",
			agent: { name: "Planner", instructions: "Plan carefully" },
			customInstructions: "Return markers",
			skills: [{ name: "plan", path: "skills/plan/SKILL.md" }],
		});

		const prompt = calls[0]?.args.at(-1) ?? "";
		expect(prompt).toContain("Agent instructions:");
		expect(prompt).toContain("Custom instructions:");
		expect(prompt).toContain("skills/plan/SKILL.md");
		expect(calls[0]?.traceId).toBe("trace-1");
		expect(result).toMatchObject({ traceId: "trace-1", backend: "opencode" });
	});

	it("extracts normalized result fields from json event output", () => {
		const jsonl = [
			`{"type":"session","session":{"id":"abc-123"}}`,
			`{"type":"part","part":{"text":"working"}}`,
			`{"type":"usage","usage":{"input_tokens":10,"output_tokens":4}}`,
			`{"type":"result","result":"done"}`,
		].join("\n");

		expect(extractSessionId(jsonl)).toBe("abc-123");
		expect(extractFinalMessage(jsonl)).toBe("done");
		expect(extractUsage(jsonl)).toEqual({
			inputTokens: 10,
			outputTokens: 4,
			totalTokens: 14,
		});
		expect(extractFinalMessage("plain result")).toBe("plain result");
	});

	it("extracts session and usage from opencode json event fields", () => {
		const jsonl = [
			`{"type":"step_start","sessionID":"ses_123","part":{"type":"step-start"}}`,
			`{"type":"text","sessionID":"ses_123","part":{"type":"text","text":"done"}}`,
			`{"type":"step_finish","sessionID":"ses_123","part":{"type":"step-finish","tokens":{"input":10,"output":4}}}`,
		].join("\n");

		expect(extractSessionId(jsonl)).toBe("ses_123");
		expect(extractFinalMessage(jsonl)).toBe("done");
		expect(extractUsage(jsonl)).toEqual({
			inputTokens: 10,
			outputTokens: 4,
			totalTokens: 14,
		});
	});

	it("maps common opencode failures with actionable hints", () => {
		expect(
			mapOpenCodeError("opencode", ["run", "x"], {
				code: 127,
				stdout: "",
				stderr: "command not found: opencode",
			}).message,
		).toContain("OPENCODE_BINARY");
		expect(
			mapOpenCodeError("opencode", ["run", "x"], {
				code: 1,
				stdout: "",
				stderr: "model not found",
			}).message,
		).toContain("OPENCODE_MODEL");
		expect(
			mapOpenCodeError("opencode", ["run", "x"], {
				code: 1,
				stdout: "",
				stderr: "connect ECONNREFUSED 127.0.0.1:11434",
			}).message,
		).toContain("local model provider");
	});

	it("maps spawn failures for missing opencode binaries", async () => {
		const adapter = new OpenCodeAdapter({
			...config,
			opencode: {
				binary: "__missing_opencode_binary__",
				streamLogs: false,
			},
		});

		await expect(adapter.runPlan("prompt")).rejects.toThrow(
			"OpenCode binary not found",
		);
	});
});
