import { describe, expect, it } from "bun:test";
import {
	buildCodexExecArgs,
	buildCodexResumeArgs,
	extractSessionId,
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
	polling: {
		intervalMs: 30000,
		maxCycles: 10,
		exitWhenIdle: true,
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
});
