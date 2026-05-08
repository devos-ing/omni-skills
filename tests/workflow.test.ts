import { describe, expect, it } from "bun:test";
import type {
	PollingConfig,
	ResolvedProjectConfig,
	RunState,
} from "../src/core/types";
import {
	appendCodexUsage,
	buildIssueJobLogFields,
	buildRunLeaseOwnerId,
	fixedBugsForImplementationComment,
	isRunStateStaleForRetry,
	normalizeFailedReviewBugs,
	parsePlannerDecision,
	resolvePollingSettings,
	routeProjectsForIssueProjectId,
	selectStaleRunIssueKeys,
	shouldRetryRunStage,
	shouldStopPolling,
} from "../src/core/workflow";

describe("resolvePollingSettings", () => {
	const polling: PollingConfig = {
		intervalMs: 30000,
		maxCycles: 12,
		exitWhenIdle: true,
		staleRunTimeoutMs: 3600000,
	};

	it("uses project defaults when options are unset", () => {
		const settings = resolvePollingSettings(polling, {});
		expect(settings).toEqual({
			enabled: false,
			intervalMs: 30000,
			maxCycles: 12,
			exitWhenIdle: true,
			staleRunTimeoutMs: 3600000,
		});
	});

	it("applies cli overrides", () => {
		const settings = resolvePollingSettings(polling, {
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
			staleRunTimeoutMs: 3600000,
		});
	});
});

describe("shouldStopPolling", () => {
	it("stops immediately when polling is disabled", () => {
		const stop = shouldStopPolling(
			{
				enabled: false,
				intervalMs: 30000,
				exitWhenIdle: true,
				staleRunTimeoutMs: 3600000,
			},
			{},
			1,
			2,
		);
		expect(stop).toBe(true);
	});

	it("stops immediately when issue is explicitly targeted", () => {
		const stop = shouldStopPolling(
			{
				enabled: true,
				intervalMs: 30000,
				exitWhenIdle: false,
				staleRunTimeoutMs: 3600000,
			},
			{ poll: true, issueArg: "ENG-1" },
			1,
			1,
		);
		expect(stop).toBe(true);
	});

	it("stops after max polling cycles", () => {
		const stop = shouldStopPolling(
			{
				enabled: true,
				intervalMs: 30000,
				maxCycles: 2,
				exitWhenIdle: false,
				staleRunTimeoutMs: 3600000,
			},
			{ poll: true },
			2,
			3,
			true,
		);
		expect(stop).toBe(true);
	});

	it("stops on global idle cycle only when enabled", () => {
		const stop = shouldStopPolling(
			{
				enabled: true,
				intervalMs: 30000,
				exitWhenIdle: true,
				staleRunTimeoutMs: 3600000,
			},
			{ poll: true },
			1,
			0,
		);
		expect(stop).toBe(true);
	});

	it("continues when any project has work in the cycle", () => {
		const stop = shouldStopPolling(
			{
				enabled: true,
				intervalMs: 30000,
				exitWhenIdle: true,
				staleRunTimeoutMs: 3600000,
			},
			{ poll: true },
			1,
			1,
		);
		expect(stop).toBe(false);
	});

	it("continues when idle cycle had a recoverable polling error", () => {
		const stop = shouldStopPolling(
			{
				enabled: true,
				intervalMs: 30000,
				exitWhenIdle: true,
				staleRunTimeoutMs: 3600000,
			},
			{ poll: true },
			1,
			0,
			true,
		);
		expect(stop).toBe(false);
	});
});

describe("stale run retry helpers", () => {
	it("flags retryable stages", () => {
		expect(shouldRetryRunStage("received")).toBe(true);
		expect(shouldRetryRunStage("planning")).toBe(true);
		expect(shouldRetryRunStage("implementing")).toBe(true);
		expect(shouldRetryRunStage("pr_created")).toBe(true);
		expect(shouldRetryRunStage("reviewing")).toBe(true);
		expect(shouldRetryRunStage("testing")).toBe(true);
		expect(shouldRetryRunStage("blocked")).toBe(false);
		expect(shouldRetryRunStage("done")).toBe(false);
	});

	it("marks only stale active run states for retry", () => {
		const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
		const oldMs = nowMs - 3600000;
		const freshMs = nowMs - 5000;
		const runStates: RunState[] = [
			createRunState("ENG-1", "planning", oldMs),
			createRunState("ENG-2", "implementing", oldMs),
			createRunState("ENG-3", "testing", oldMs),
			createRunState("ENG-4", "planning", freshMs),
			createRunState("ENG-5", "done", oldMs),
		];
		const keys = selectStaleRunIssueKeys(runStates, nowMs, 600000);
		expect(keys).toEqual(["ENG-1", "ENG-2", "ENG-3"]);
	});

	it("does not mark state as stale while another active lease is valid", () => {
		const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
		const oldMs = nowMs - 3600000;
		const leaseExpiresAtMs = nowMs + 60000;
		const state = createRunState("ENG-11", "implementing", oldMs);
		state.lease = {
			ownerId: "worker-a",
			acquiredAt: new Date(oldMs).toISOString(),
			heartbeatAt: new Date(nowMs - 1000).toISOString(),
			expiresAt: new Date(leaseExpiresAtMs).toISOString(),
		};

		expect(isRunStateStaleForRetry(state, nowMs, 600000)).toBe(false);
	});

	it("marks state as stale when lease has expired", () => {
		const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
		const oldMs = nowMs - 3600000;
		const state = createRunState("ENG-12", "reviewing", oldMs);
		state.lease = {
			ownerId: "worker-a",
			acquiredAt: new Date(oldMs).toISOString(),
			heartbeatAt: new Date(oldMs).toISOString(),
			expiresAt: new Date(nowMs - 1).toISOString(),
		};

		expect(isRunStateStaleForRetry(state, nowMs, 600000)).toBe(true);
	});

	it("ignores invalid updatedAt values", () => {
		const state = createRunState("ENG-9", "planning", Date.now());
		state.updatedAt = "not-a-date";
		expect(isRunStateStaleForRetry(state, Date.now(), 1000)).toBe(false);
	});
});

describe("buildRunLeaseOwnerId", () => {
	it("returns a process-scoped lease owner id", () => {
		const ownerId = buildRunLeaseOwnerId(123456);
		expect(ownerId).toContain("-123456-");
		expect(ownerId.split("-").length).toBe(3);
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

describe("normalizeFailedReviewBugs", () => {
	it("returns empty list when review passed", () => {
		expect(
			normalizeFailedReviewBugs({
				passed: true,
				summary: "Looks good.",
				bugs: [{ title: "Ignored", body: "ignored" }],
			}),
		).toEqual([]);
	});

	it("returns reviewer bugs when present", () => {
		expect(
			normalizeFailedReviewBugs({
				passed: false,
				summary: "Found issues.",
				bugs: [{ title: "Bug A", body: "Details" }],
			}),
		).toEqual([{ title: "Bug A", body: "Details" }]);
	});

	it("creates fallback bug when failed without BUGS_JSON details", () => {
		const bugs = normalizeFailedReviewBugs({
			passed: false,
			summary: "Result failed with malformed output.",
			bugs: [],
		});
		expect(bugs).toHaveLength(1);
		expect(bugs[0]?.title).toContain("failed without structured bug details");
		expect(bugs[0]?.body).toContain("Result failed with malformed output.");
	});
});

describe("fixedBugsForImplementationComment", () => {
	it("returns a copy of bugs for fix rounds", () => {
		const source = [
			{
				title: "Bug A",
				body: "Details",
				issueUrl: "https://linear.app/roy/issue/ROY-1/bug-a",
			},
		];
		const fixed = fixedBugsForImplementationComment(true, source);
		expect(fixed).toEqual(source);
		expect(fixed).not.toBe(source);
	});

	it("returns empty when no existing PR is present", () => {
		const fixed = fixedBugsForImplementationComment(false, [
			{ title: "Bug A", body: "Details" },
		]);
		expect(fixed).toEqual([]);
	});

	it("returns empty when bug list is empty", () => {
		const fixed = fixedBugsForImplementationComment(true, []);
		expect(fixed).toEqual([]);
	});
});

describe("parsePlannerDecision", () => {
	it("defaults to SIMPLE when complexity marker is missing", () => {
		const result = parsePlannerDecision(
			[
				"Scope summary",
				"- Keep behavior unchanged.",
				"Implementation steps",
				"- Proceed directly.",
			].join("\n"),
		);
		expect(result).toEqual({
			complexity: "SIMPLE",
			splitTasks: [],
		});
	});

	it("parses COMPLEX with valid split task JSON", () => {
		const result = parsePlannerDecision(
			[
				"COMPLEXITY: COMPLEX",
				"SPLIT_TASKS_JSON:",
				"```json",
				JSON.stringify(
					[
						{
							title: "Task A",
							description: "Ship part A",
							labels: ["backend", "urgent"],
							priority: 2,
						},
						{
							title: "Task B",
						},
					],
					null,
					2,
				),
				"```",
			].join("\n"),
		);

		expect(result.complexity).toBe("COMPLEX");
		expect(result.splitTasks).toEqual([
			{
				title: "Task A",
				description: "Ship part A",
				labels: ["backend", "urgent"],
				priority: 2,
			},
			{
				title: "Task B",
				description: undefined,
				labels: undefined,
				priority: undefined,
			},
		]);
	});

	it("throws when COMPLEX split task JSON is malformed", () => {
		expect(() =>
			parsePlannerDecision(
				[
					"COMPLEXITY: COMPLEX",
					"SPLIT_TASKS_JSON: [",
					'{"title":"Task A"}',
				].join("\n"),
			),
		).toThrow("did not contain a JSON array");
	});

	it("throws when COMPLEX split task array is empty", () => {
		expect(() =>
			parsePlannerDecision(
				["COMPLEXITY: COMPLEX", "SPLIT_TASKS_JSON: []"].join("\n"),
			),
		).toThrow("must be a non-empty JSON array");
	});
});

function createProject(
	id: string,
	linearProjectId?: string,
): ResolvedProjectConfig {
	return {
		id,
		name: id,
		workspacePath: "/tmp/workspace",
		executionPath: "/tmp/repo",
		repo: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		linear: {
			apiKey: "key",
			apiUrl: "https://api.linear.app/graphql",
			projectId: linearProjectId,
			teamId: undefined,
			requiredLabel: undefined,
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
			labelMap: {
				pr_created: "PR Created",
				reviewing: "Reviewing",
				testing: "Testing",
			},
			autoCreateLabels: true,
		},
		github: {
			useGhCli: true,
			defaultBugLabel: "bug",
		},
		codex: {
			binary: "codex",
			streamLogs: false,
		},
		skills: {
			root: "/tmp/skills",
			plan: "/tmp/plan.md",
			implement: "/tmp/implement.md",
			reviewTest: "/tmp/review.md",
		},
		dryRun: false,
	};
}

function createRunState(
	issueKey: string,
	stage: RunState["stage"],
	updatedAtMs: number,
): RunState {
	const updatedAt = new Date(updatedAtMs).toISOString();
	return {
		projectId: "default",
		projectName: "Default",
		workspacePath: "/tmp/work",
		repository: {
			owner: "acme",
			name: "repo",
			baseBranch: "main",
		},
		issue: {
			id: `lin_${issueKey}`,
			key: issueKey,
			title: issueKey,
			url: `https://linear.app/acme/issue/${issueKey}/sample`,
		},
		stage,
		bugs: [],
		startedAt: updatedAt,
		updatedAt,
	};
}

describe("routeProjectsForIssueProjectId", () => {
	it("routes to explicit linear.projectId match", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api", "proj_api"), createProject("web", "proj_web")],
			"proj_web",
		);
		expect(result).toEqual({
			selectedProjectId: "web",
		});
	});

	it("skips when no configured project matches issue project id", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api", "proj_api"), createProject("web", "proj_web")],
			"proj_unknown",
		);
		expect(result.selectedProjectId).toBeUndefined();
		expect(result.error).toBeUndefined();
		expect(result.skipReason).toContain("No project configured");
	});

	it("fails when multiple projects share same linear.projectId", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api", "proj_a"), createProject("web", "proj_a")],
			"proj_a",
		);
		expect(result.error).toContain("Multiple projects are configured");
	});

	it("fails when issue has no project id and multiple unscoped projects exist", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api"), createProject("web")],
			undefined,
		);
		expect(result.error).toContain("multiple unscoped projects");
	});
});
