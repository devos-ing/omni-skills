import { describe, expect, it } from "bun:test";
import {
	buildCodexExecArgs,
	buildCodexResumeArgs,
	extractSessionId,
	extractUsage,
} from "../src/codex";
import type { ResolvedProjectConfig } from "../src/types";

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
		model: "gpt-5.4",
		models: {
			plan: "gpt-5.5",
			implement: "gpt-5.3-codex",
			reviewTest: "gpt-5.3-codex",
		},
		sandbox: "workspace-write",
		codexHome: "/tmp/codex",
	},
	skills: { plan: "p", implement: "i", reviewTest: "r" },
	dryRun: false,
};

describe("codex args", () => {
	it("builds exec args with output file", () => {
		const args = buildCodexExecArgs(config, "hello", "/tmp/out.txt");
		expect(args).toContain("exec");
		expect(args).toContain("--json");
		expect(args).toContain("--output-last-message");
		expect(args).toContain("/tmp/out.txt");
		expect(args).toContain("--sandbox");
	});

	it("supports stage model overrides", () => {
		const planArgs = buildCodexExecArgs(
			config,
			"plan",
			"/tmp/out.txt",
			config.codex.models?.plan,
		);
		expect(planArgs).toEqual(expect.arrayContaining(["--model", "gpt-5.5"]));

		const implementArgs = buildCodexResumeArgs(
			config,
			"session-123",
			"implement",
			"/tmp/out.txt",
			config.codex.models?.implement,
		);
		expect(implementArgs).toEqual(
			expect.arrayContaining(["--model", "gpt-5.3-codex"]),
		);
	});

	it("omits sandbox when not configured", () => {
		const args = buildCodexExecArgs(
			{ ...config, codex: { ...config.codex, sandbox: undefined } },
			"hello",
			"/tmp/out.txt",
		);
		expect(args).not.toContain("--sandbox");
	});

	it("builds resume args with session", () => {
		const args = buildCodexResumeArgs(
			config,
			"session-123",
			"continue",
			"/tmp/out.txt",
		);
		expect(args).toEqual(
			expect.arrayContaining([
				"exec",
				"resume",
				"session-123",
				"continue",
				"--json",
			]),
		);
		expect(args).not.toContain("--sandbox");
		expect(args).not.toContain("--cd");
	});

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
});
