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
	github: { useGhCli: true, defaultBugLabel: "bug" },
	codex: {
		binary: "codex",
		model: "gpt-5.4",
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
	});

	it("extracts session id from jsonl", () => {
		const jsonl = `{"type":"thread.started","thread_id":"abc-123"}\n{"type":"turn.completed"}`;
		expect(extractSessionId(jsonl)).toBe("abc-123");
	});
});
