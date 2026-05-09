import { describe, expect, it } from "bun:test";
import {
	CodexAdapter,
	extractSessionId,
	extractUsage,
} from "../src/agent-adapters/codex";
import type { ResolvedProjectConfig } from "../src/core/types";

const config: ResolvedProjectConfig = {
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
		model: "gpt-5.4",
		reasoningEffort: "medium",
		models: {
			plan: "gpt-5.5",
			implement: "gpt-5.3-codex",
			reviewTest: "gpt-5.3-codex",
		},
		reasoningEfforts: {
			plan: "high",
			implement: "low",
		},
		fastModes: {
			plan: true,
			implement: false,
			reviewTest: true,
		},
		plugins: ["github@openai-curated", "linear@openai-curated"],
		skillsets: ["adhd-ai", "repo-defaults"],
		configOverrides: {
			"features.experimental_tools": "true",
		},
		sandbox: "workspace-write",
		codexHome: "/tmp/codex",
	},
	skills: { root: "/tmp/skills", plan: "p", implement: "i", reviewTest: "r" },
	dryRun: false,
};

describe("codex adapter", () => {
	it("extracts session id from jsonl", () => {
		const jsonl = `{"type":"thread.started","thread_id":"abc-123"}\n{"type":"turn.completed"}`;
		expect(extractSessionId(jsonl)).toBe("abc-123");
	});

	it("extracts usage from nested usage object", () => {
		const jsonl = `{"type":"turn.completed","usage":{"input_tokens":120,"output_tokens":30,"total_tokens":150}}`;
		expect(extractUsage(jsonl)).toEqual({
			inputTokens: 120,
			outputTokens: 30,
			totalTokens: 150,
		});
	});

	it("extracts usage from camelCase keys", () => {
		const jsonl = `{"type":"turn.completed","metrics":{"inputTokens":9,"outputTokens":4}}`;
		expect(extractUsage(jsonl)).toEqual({
			inputTokens: 9,
			outputTokens: 4,
			totalTokens: 13,
		});
	});

	it("uses latest usage across multiple events and ignores bad lines", () => {
		const jsonl = [
			`{"type":"turn.progress","usage":{"prompt_tokens":10,"completion_tokens":2}}`,
			"not json",
			`{"type":"turn.completed","usage":{"prompt_tokens":20,"completion_tokens":5}}`,
		].join("\n");
		expect(extractUsage(jsonl)).toEqual({
			inputTokens: 20,
			outputTokens: 5,
			totalTokens: 25,
		});
	});

	it("creates adapter instance", () => {
		const adapter = new CodexAdapter(config);
		expect(adapter).toBeDefined();
		expect(typeof adapter.runPlan).toBe("function");
		expect(typeof adapter.resume).toBe("function");
		expect(typeof adapter.runReview).toBe("function");
	});

	it("uses stage-specific reasoning effort overrides", async () => {
		const adapter = new CodexAdapter(config);
		const calls: string[][] = [];
		(
			adapter as unknown as { runCodex: (args: string[]) => Promise<unknown> }
		).runCodex = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};
		(
			adapter as unknown as { nextOutputFile: () => Promise<string> }
		).nextOutputFile = async () => "/tmp/out.txt";

		await adapter.runPlan("plan prompt");
		await adapter.resume("session-1", "implement prompt");
		await adapter.runReview("review prompt");

		expect(calls).toHaveLength(3);
		expect(calls[0]).toContain('model_reasoning_effort="high"');
		expect(calls[1]).toContain('model_reasoning_effort="low"');
		expect(calls[2]).toContain('model_reasoning_effort="low"');
	});

	it("uses stage-specific fast mode overrides", async () => {
		const adapter = new CodexAdapter(config);
		const calls: string[][] = [];
		(
			adapter as unknown as { runCodex: (args: string[]) => Promise<unknown> }
		).runCodex = async (args: string[]) => {
			calls.push(args);
			return { finalMessage: "", stdout: "" };
		};
		(
			adapter as unknown as { nextOutputFile: () => Promise<string> }
		).nextOutputFile = async () => "/tmp/out.txt";

		await adapter.runPlan("plan prompt");
		await adapter.resume("session-1", "implement prompt");
		await adapter.runReview("review prompt");

		expect(calls).toHaveLength(3);
		expect(calls[0]).toContain('service_tier="fast"');
		expect(calls[0]).toContain("features.fast_mode=true");
		expect(calls[1]).not.toContain('service_tier="fast"');
		expect(calls[1]).not.toContain("features.fast_mode=true");
		expect(calls[2]).toContain('service_tier="fast"');
		expect(calls[2]).toContain("features.fast_mode=true");
	});

	it("keeps raw config override as final reasoning-effort escape hatch", () => {
		const adapter = new CodexAdapter({
			...config,
			codex: {
				...config.codex,
				configOverrides: {
					model_reasoning_effort: '"xhigh"',
				},
			},
		});
		const overrides = (
			adapter as unknown as {
				buildConfigOverrides: (effort?: string, fastMode?: boolean) => string[];
			}
		).buildConfigOverrides("low");
		const first = overrides.indexOf('model_reasoning_effort="low"');
		const second = overrides.indexOf('model_reasoning_effort="xhigh"');
		expect(first).toBeGreaterThanOrEqual(0);
		expect(second).toBeGreaterThan(first);
	});

	it("keeps raw config override as final fast-mode escape hatch", () => {
		const adapter = new CodexAdapter({
			...config,
			codex: {
				...config.codex,
				configOverrides: {
					service_tier: '"default"',
					"features.fast_mode": "false",
				},
			},
		});
		const overrides = (
			adapter as unknown as {
				buildConfigOverrides: (effort?: string, fastMode?: boolean) => string[];
			}
		).buildConfigOverrides(undefined, true);
		const fastTier = overrides.indexOf('service_tier="fast"');
		const defaultTier = overrides.indexOf('service_tier="default"');
		const fastModeTrue = overrides.indexOf("features.fast_mode=true");
		const fastModeFalse = overrides.indexOf("features.fast_mode=false");
		expect(fastTier).toBeGreaterThanOrEqual(0);
		expect(defaultTier).toBeGreaterThan(fastTier);
		expect(fastModeTrue).toBeGreaterThanOrEqual(0);
		expect(fastModeFalse).toBeGreaterThan(fastModeTrue);
	});
});
