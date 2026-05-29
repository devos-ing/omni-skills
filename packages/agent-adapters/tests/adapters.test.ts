import { describe, expect, it } from "bun:test";
import type { AgentResult } from "../src";
import {
	agentConfigurationDoc,
	availableAgentModels,
	createAgentAdapter,
	getAgentBackendDefinition,
	listAgentBackends,
	normalizeAgentBackend,
	resolveAgentConfiguration,
} from "../src";
import { ClaudeCodeAdapter } from "../src/claude";
import { CodexAdapter, extractSessionId, extractUsage } from "../src/codex";
import { buildCodexRuntimeInvocation } from "../src/codex/docker";
import { CursorAgentAdapter } from "../src/cursor";
import { OpenCodeAdapter } from "../src/opencode/adapter";
import { config } from "./fixtures";

describe("agent adapter factory", () => {
	it("defaults to codex and honors backend overrides", () => {
		expect(createAgentAdapter(config)).toBeInstanceOf(CodexAdapter);
		expect(
			createAgentAdapter({ ...config, agent: { backend: "claude-code" } }),
		).toBeInstanceOf(ClaudeCodeAdapter);
		expect(
			createAgentAdapter({ ...config, agent: { backend: "cursor-agent" } }),
		).toBeInstanceOf(CursorAgentAdapter);
		expect(
			createAgentAdapter({ ...config, agent: { backend: "opencode" } }),
		).toBeInstanceOf(OpenCodeAdapter);
		expect(
			createAgentAdapter(
				{ ...config, agent: { backend: "claude-code" } },
				"codex",
			),
		).toBeInstanceOf(CodexAdapter);
	});

	it("throws for unknown backend values", () => {
		expect(() => createAgentAdapter(config, "not-a-backend" as never)).toThrow(
			"Unknown agent backend: not-a-backend",
		);
	});

	it("validates runtime config before creating adapters", () => {
		expect(() =>
			createAgentAdapter({
				...config,
				executionPath: "",
			}),
		).toThrow("Agent adapter runtime config validation failed");
	});

	it("exposes backend definitions from the shared registry", () => {
		expect(listAgentBackends().map((definition) => definition.backend)).toEqual(
			["codex", "claude-code", "cursor-agent", "opencode"],
		);
		expect(normalizeAgentBackend(" Cursor-Agent ")).toBe("cursor-agent");
		expect(normalizeAgentBackend(" Claude-Code ")).toBe("claude-code");
		expect(normalizeAgentBackend(" OpenCode ")).toBe("opencode");
		const codexDefinition = getAgentBackendDefinition("codex");
		expect(codexDefinition?.defaultModel).toBe("gpt-5.5");
		expect(codexDefinition?.createAdapter(config)).toBeInstanceOf(CodexAdapter);
	});

	it("publishes model constants and configuration docs", () => {
		expect(availableAgentModels.codex.map((model) => model.id)).toContain(
			"gpt-5.3-codex",
		);
		expect(
			availableAgentModels["claude-code"].map((model) => model.id),
		).toEqual(["claude-sonnet-4-20250514", "claude-opus-4-20250514"]);
		expect(agentConfigurationDoc.codex.defaults.models?.plan).toBe("gpt-5.5");
		expect(
			agentConfigurationDoc["claude-code"].env.map((field) => field.name),
		).toContain("CLAUDE_CODE_MODEL");
		expect(agentConfigurationDoc["cursor-agent"].defaults.model).toBe("auto");
		expect(agentConfigurationDoc.opencode.defaults.model).toBe(
			"ollama/qwen2.5-coder:32b",
		);
	});

	it("resolves known and custom models without hard-blocking custom ids", () => {
		const known = resolveAgentConfiguration({
			backend: "codex",
			model: "gpt-5.4-mini",
		});
		expect(known.isKnownModel).toBe(true);
		expect(known.modelDefinition?.id).toBe("gpt-5.4-mini");

		const custom = resolveAgentConfiguration({
			backend: "codex",
			model: "gpt-custom-future",
		});
		expect(custom).toMatchObject({
			backend: "codex",
			model: "gpt-custom-future",
			isKnownModel: false,
		});
	});

	it("can strictly reject custom models when requested", () => {
		expect(() =>
			resolveAgentConfiguration(
				{ backend: "codex", model: "gpt-custom-future" },
				{ allowCustomModel: false },
			),
		).toThrow("Unknown codex model: gpt-custom-future");
	});
});

describe("codex adapter", () => {
	it("extracts session ids and latest usage from jsonl output", () => {
		const jsonl = [
			`{"type":"thread.started","thread_id":"abc-123"}`,
			`{"type":"turn.progress","usage":{"prompt_tokens":10,"completion_tokens":2}}`,
			"not json",
			`{"type":"turn.completed","usage":{"inputTokens":20,"outputTokens":5}}`,
		].join("\n");

		expect(extractSessionId(jsonl)).toBe("abc-123");
		expect(extractUsage(jsonl)).toEqual({
			inputTokens: 20,
			outputTokens: 5,
			totalTokens: 25,
		});
	});

	it("builds stage-specific command arguments", async () => {
		const adapter = new CodexAdapter({
			...config,
			codex: {
				...config.codex,
				models: {
					...config.codex.models,
					brainstorm: "gpt-5.4-mini",
				},
				reasoningEfforts: {
					...config.codex.reasoningEfforts,
					brainstorm: "xhigh",
				},
			},
		});
		const calls: string[][] = [];
		(
			adapter as unknown as {
				runCodex: (args: string[]) => Promise<AgentResult>;
			}
		).runCodex = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};
		(
			adapter as unknown as { nextOutputFile: () => Promise<string> }
		).nextOutputFile = async () => "/tmp/out.txt";

		await adapter.runAgent?.({
			role: "brainstorm",
			prompt: "brainstorm prompt",
		});
		await adapter.runPlan("plan prompt");
		await adapter.resume("session-1", "implement prompt");
		await adapter.runGithubComment("comment prompt");

		expect(calls[0]).toContain("gpt-5.4-mini");
		expect(calls[0]).toContain('model_reasoning_effort="xhigh"');
		expect(calls[1]).toContain("gpt-5.5");
		expect(calls[1]).toContain('model_reasoning_effort="high"');
		expect(calls[1]).toContain('service_tier="fast"');
		expect(calls[2]).toContain("gpt-5.3-codex");
		expect(calls[2]).toContain('model_reasoning_effort="low"');
		expect(calls[3]).toContain("gpt-5.4-mini");
		expect(calls[3]).not.toContain('service_tier="fast"');
	});

	it("wraps codex args in docker when configured", () => {
		const invocation = buildCodexRuntimeInvocation(
			{
				...config,
				codex: {
					...config.codex,
					docker: { enabled: true, image: "codex:latest" },
				},
			},
			[
				"exec",
				"--cd",
				"/tmp/work/repo",
				"--output-last-message",
				"/tmp/work/.devos/tmp/out.txt",
				"prompt",
			],
		);

		expect(invocation.command).toBe("docker");
		expect(invocation.args).toContain("codex:latest");
		expect(invocation.args).toContain("/workspace/repo");
		expect(invocation.args).toContain("/workspace/.devos/tmp/out.txt");
	});
});
