import { describe, expect, it } from "bun:test";
import type { ResolvedProjectConfig, RunState } from "../src/types";
import {
	appendCodexUsage,
	buildIssueJobLogFields,
	buildPlanComment,
	parseReviewOutcome,
	resolvePollingSettings,
	shouldStopPolling,
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

describe("shouldStopPolling", () => {
	it("stops immediately when polling is disabled", () => {
		const stop = shouldStopPolling(
			{ enabled: false, intervalMs: 30000, exitWhenIdle: true },
			{},
			1,
			2,
		);
		expect(stop).toBe(true);
	});

	it("stops immediately when issue is explicitly targeted", () => {
		const stop = shouldStopPolling(
			{ enabled: true, intervalMs: 30000, exitWhenIdle: false },
			{ poll: true, issueArg: "ENG-1" },
			1,
			1,
		);
		expect(stop).toBe(true);
	});

	it("stops after max polling cycles", () => {
		const stop = shouldStopPolling(
			{ enabled: true, intervalMs: 30000, maxCycles: 2, exitWhenIdle: false },
			{ poll: true },
			2,
			3,
		);
		expect(stop).toBe(true);
	});

	it("stops on global idle cycle only when enabled", () => {
		const stop = shouldStopPolling(
			{ enabled: true, intervalMs: 30000, exitWhenIdle: true },
			{ poll: true },
			1,
			0,
		);
		expect(stop).toBe(true);
	});

	it("continues when any project has work in the cycle", () => {
		const stop = shouldStopPolling(
			{ enabled: true, intervalMs: 30000, exitWhenIdle: true },
			{ poll: true },
			1,
			1,
		);
		expect(stop).toBe(false);
	});
});

describe("buildIssueJobLogFields", () => {
	it("returns consistent issue job fields", () => {
		const now = new Date().toISOString();
		const fields = buildIssueJobLogFields(
			{
				projectId: "default",
				projectName: "Default",
				workspacePath: "/tmp/work",
				repository: {
					owner: "acme",
					name: "repo",
					baseBranch: "main",
				},
				issue: {
					id: "lin_123",
					key: "ENG-1",
					title: "Improve logging",
					url: "https://linear.app/acme/issue/ENG-1/improve-logging",
				},
				stage: "planning",
				bugs: [],
				startedAt: now,
				updatedAt: now,
			},
			"planning",
		);

		expect(fields).toEqual({
			projectId: "default",
			issueKey: "ENG-1",
			issueId: "lin_123",
			issueTitle: "Improve logging",
			stage: "planning",
		});
	});

	it("includes resumed flag when issue run is resumed", () => {
		const now = new Date().toISOString();
		const fields = buildIssueJobLogFields(
			{
				projectId: "default",
				projectName: "Default",
				workspacePath: "/tmp/work",
				repository: {
					owner: "acme",
					name: "repo",
					baseBranch: "main",
				},
				issue: {
					id: "lin_123",
					key: "ENG-1",
					title: "Improve logging",
					url: "https://linear.app/acme/issue/ENG-1/improve-logging",
				},
				stage: "implementing",
				bugs: [],
				startedAt: now,
				updatedAt: now,
			},
			"implementing",
			{ resumed: true },
		);

		expect(fields).toEqual({
			projectId: "default",
			issueKey: "ENG-1",
			issueId: "lin_123",
			issueTitle: "Improve logging",
			stage: "implementing",
			resumed: true,
		});
	});
});

describe("appendCodexUsage", () => {
	it("appends usage when run state has no existing usage array", () => {
		const now = new Date().toISOString();
		const state: RunState = {
			projectId: "default",
			projectName: "Default",
			workspacePath: "/tmp/work",
			repository: {
				owner: "acme",
				name: "repo",
				baseBranch: "main",
			},
			issue: {
				id: "lin_123",
				key: "ENG-1",
				title: "Improve logging",
				url: "https://linear.app/acme/issue/ENG-1/improve-logging",
			},
			stage: "planning",
			bugs: [],
			startedAt: now,
			updatedAt: now,
		};

		appendCodexUsage(state, "planning", {
			inputTokens: 12,
			outputTokens: 8,
			totalTokens: 20,
		});

		expect(state.codexUsage).toHaveLength(1);
		expect(state.codexUsage?.[0]).toMatchObject({
			stage: "planning",
			inputTokens: 12,
			outputTokens: 8,
			totalTokens: 20,
		});
		expect(typeof state.codexUsage?.[0]?.recordedAt).toBe("string");
	});

	it("does nothing when usage is undefined", () => {
		const now = new Date().toISOString();
		const state: RunState = {
			projectId: "default",
			projectName: "Default",
			workspacePath: "/tmp/work",
			repository: {
				owner: "acme",
				name: "repo",
				baseBranch: "main",
			},
			issue: {
				id: "lin_123",
				key: "ENG-1",
				title: "Improve logging",
				url: "https://linear.app/acme/issue/ENG-1/improve-logging",
			},
			stage: "planning",
			bugs: [],
			codexUsage: [],
			startedAt: now,
			updatedAt: now,
		};

		appendCodexUsage(state, "planning", undefined);
		expect(state.codexUsage).toHaveLength(0);
	});
});
