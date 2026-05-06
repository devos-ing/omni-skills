import { describe, expect, it } from "bun:test";
import type { ResolvedProjectConfig } from "../src/types";
import {
	buildPlanComment,
	parseReviewOutcome,
	resolvePollingSettings,
} from "../src/workflow";

describe("parseReviewOutcome", () => {
	it("parses pass with no bugs", () => {
		const text = `
RESULT: PASS
SUMMARY: Looks good.
BUGS_JSON:
[]
`;
		const outcome = parseReviewOutcome(text);
		expect(outcome.passed).toBe(true);
		expect(outcome.bugs).toHaveLength(0);
	});

	it("parses fail with bugs", () => {
		const text = `
RESULT: FAIL
SUMMARY: Found regressions.
BUGS_JSON:
[{"title":"Bug A","body":"Details"}]
`;
		const outcome = parseReviewOutcome(text);
		expect(outcome.passed).toBe(false);
		expect(outcome.bugs).toHaveLength(1);
		expect(outcome.bugs[0]?.title).toBe("Bug A");
	});
});

describe("buildPlanComment", () => {
	it("includes header and plan summary", () => {
		const comment = buildPlanComment("ENG-1", "1. Do A\n2. Do B");
		expect(comment).toContain("PIV loop plan for ENG-1");
		expect(comment).toContain("Planning completed; implementation started.");
		expect(comment).toContain("1. Do A");
	});

	it("uses fallback when no summary is returned", () => {
		const comment = buildPlanComment("ENG-1", "   ");
		expect(comment).toContain("(No plan summary returned by planning agent.)");
	});
});

describe("resolvePollingSettings", () => {
	const project = {
		id: "default",
		name: "Default",
		workspacePath: "/tmp/state",
		executionPath: "/tmp/repo",
		repo: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		linear: {
			apiKey: "key",
			apiUrl: "https://api.linear.app/graphql",
			pollLimit: 10,
			statusMap: {
				assigned: "Todo",
				planning: "In Progress",
				implementing: "In Progress",
				pr_created: "In Review",
				reviewing: "In Review",
				testing: "In Review",
				blocked: "Canceled",
				done: "Done",
			},
			labelMap: {},
			autoCreateLabels: true,
		},
		polling: {
			intervalMs: 30000,
			maxCycles: 12,
			exitWhenIdle: true,
		},
		github: {
			useGhCli: true,
			defaultBugLabel: "bug",
		},
		codex: {
			binary: "codex",
		},
		skills: {
			plan: "plan.md",
			implement: "implement.md",
			reviewTest: "review.md",
		},
		dryRun: true,
	} satisfies ResolvedProjectConfig;

	it("uses project defaults when options are unset", () => {
		const settings = resolvePollingSettings(project, {});
		expect(settings).toEqual({
			enabled: false,
			intervalMs: 30000,
			maxCycles: 12,
			exitWhenIdle: true,
		});
	});

	it("applies cli overrides", () => {
		const settings = resolvePollingSettings(project, {
			poll: true,
			pollIntervalMs: 15000,
			maxPollCycles: 2,
			exitWhenIdle: false,
		});
		expect(settings).toEqual({
			enabled: true,
			intervalMs: 15000,
			maxCycles: 2,
			exitWhenIdle: false,
		});
	});
});
