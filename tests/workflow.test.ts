import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { AgentAdapter } from "../src/agent-adapters";
import { handlePlanningStage } from "../src/core/plan";
import {
	agentChatLogPath,
	applyRunLease,
	isRunLeaseExpired,
	transitionStage,
} from "../src/core/state";
import type {
	IssueRef,
	PollingConfig,
	ResolvedProjectConfig,
	RunState,
} from "../src/core/types";
import {
	appendCodexUsage,
	applyPlannerIssueRefinement,
	buildIssueJobLogFields,
	buildPrioritizedIssueQueue,
	buildReviewOnlyIssueQueue,
	buildRunLeaseOwnerId,
	finalizeIssueAfterReviewMerge,
	fixedBugsForImplementationComment,
	handleReviewTestingStage,
	isReviewOnlyEligibleRunState,
	isReviewOnlyExecutableStage,
	isRunStateStaleForRetry,
	normalizeFailedReviewBugs,
	parsePlannerComplexityScore,
	parsePlannerDecision,
	parsePlannerIssueRefinement,
	readyPullRequestAfterPassingReview,
	resolvePollingSettings,
	resolveReviewFailureStage,
	resolveReviewModeForComplexityScore,
	resolveReviewOnlyBootstrapStage,
	routeProjectsForIssueProjectId,
	runAgentWithChatLog,
	selectIssueQueueForCycle,
	selectReviewOnlyIssueKeys,
	selectStaleRunIssueKeys,
	shouldRetryRunStage,
	shouldSkipReviewOnlyRunState,
	shouldSquashMergePullRequestForComplexityScore,
	shouldStopPolling,
	withExecutionPathLock,
} from "../src/core/workflow";
import { processIssueQueueBounded } from "../src/core/workflow-queue";

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

describe("processIssueQueueBounded", () => {
	it("falls back to sequential processing for undefined concurrency", async () => {
		const maxWorkersSeen = { value: 0 };
		let activeWorkers = 0;

		await processIssueQueueBounded([1, 2, 3], undefined, async () => {
			activeWorkers += 1;
			maxWorkersSeen.value = Math.max(maxWorkersSeen.value, activeWorkers);
			await new Promise((resolve) => setTimeout(resolve, 1));
			activeWorkers -= 1;
		});

		expect(maxWorkersSeen.value).toBe(1);
	});

	it("respects explicit concurrency values above one", async () => {
		const maxWorkersSeen = { value: 0 };
		let activeWorkers = 0;

		await processIssueQueueBounded([1, 2, 3], 2, async () => {
			activeWorkers += 1;
			maxWorkersSeen.value = Math.max(maxWorkersSeen.value, activeWorkers);
			await new Promise((resolve) => setTimeout(resolve, 5));
			activeWorkers -= 1;
		});

		expect(maxWorkersSeen.value).toBe(2);
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

describe("buildPrioritizedIssueQueue", () => {
	it("sorts merged assigned and stale-retry issues by priority", () => {
		const assignedIssues = [
			createWorkflowIssue("ROY-2", 2, "High"),
			createWorkflowIssue("ROY-4", 4, "Low"),
		];
		const staleRetryIssues = [
			createWorkflowIssue("ROY-1", 1, "Urgent"),
			createWorkflowIssue("ROY-3", 3, "Medium"),
		];

		const queue = buildPrioritizedIssueQueue(assignedIssues, staleRetryIssues);
		expect(queue.map((issue) => issue.identifier)).toEqual([
			"ROY-1",
			"ROY-2",
			"ROY-3",
			"ROY-4",
		]);
	});

	it("keeps first occurrence when assigned and stale queues overlap", () => {
		const assignedIssues = [createWorkflowIssue("ROY-20", 4, "Low")];
		const staleRetryIssues = [createWorkflowIssue("ROY-20", 1, "Urgent")];

		const queue = buildPrioritizedIssueQueue(assignedIssues, staleRetryIssues);
		expect(queue).toHaveLength(1);
		expect(queue[0]?.priority.value).toBe(4);
	});

	it("bypasses merged sorting when a specific issue is targeted", () => {
		const assignedIssues = [createWorkflowIssue("ROY-9", 4, "Low")];
		const staleRetryIssues = [createWorkflowIssue("ROY-8", 1, "Urgent")];

		const queue = selectIssueQueueForCycle(
			"ROY-9",
			assignedIssues,
			staleRetryIssues,
		);
		expect(queue.map((issue) => issue.identifier)).toEqual(["ROY-9"]);
	});

	it("sorts merged queues when polling without an explicit issue target", () => {
		const assignedIssues = [createWorkflowIssue("ROY-9", 4, "Low")];
		const staleRetryIssues = [createWorkflowIssue("ROY-8", 1, "Urgent")];

		const queue = selectIssueQueueForCycle(
			undefined,
			assignedIssues,
			staleRetryIssues,
		);
		expect(queue.map((issue) => issue.identifier)).toEqual(["ROY-8", "ROY-9"]);
	});
});

describe("review-only selection", () => {
	it("selects resumable review-stage run states with an existing PR", () => {
		const now = Date.parse("2026-05-07T12:00:00.000Z");
		const runStates: RunState[] = [
			{
				...createRunState("ROY-1", "pr_created", now),
				pullRequest: {
					branch: "codex/roy-1",
					title: "PR",
					url: "https://pr/1",
				},
			},
			{
				...createRunState("ROY-2", "reviewing", now),
				pullRequest: {
					branch: "codex/roy-2",
					title: "PR",
					url: "https://pr/2",
				},
			},
			{
				...createRunState("ROY-3", "testing", now),
				pullRequest: {
					branch: "codex/roy-3",
					title: "PR",
					url: "https://pr/3",
				},
			},
			{
				...createRunState("ROY-4", "reviewing", now),
				pullRequest: { branch: "codex/roy-4", title: "PR" },
			},
			{
				...createRunState("ROY-5", "done", now),
				pullRequest: {
					branch: "codex/roy-5",
					title: "PR",
					url: "https://pr/5",
				},
			},
			{
				...createRunState("ROY-6", "done", now),
				pullRequestApprovedAt: "2026-05-07T12:30:00.000Z",
				pullRequest: {
					branch: "codex/roy-6",
					title: "PR",
					url: "https://pr/6",
				},
			},
			createRunState("ROY-7", "implementing", now),
		];

		expect(selectReviewOnlyIssueKeys(runStates)).toEqual([
			"ROY-1",
			"ROY-2",
			"ROY-3",
			"ROY-5",
		]);
	});

	it("merges local and Linear review-only candidates and skips missing PRs", () => {
		const now = Date.parse("2026-05-07T12:00:00.000Z");
		const runStates: RunState[] = [
			{
				...createRunState("ROY-1", "reviewing", now),
				pullRequest: {
					branch: "codex/roy-1",
					title: "PR",
					url: "https://github.com/acme/repo/pull/1",
				},
			},
		];
		const localIssues = [createWorkflowIssue("ROY-1", 2, "High")];
		const linearIssues = [
			createWorkflowIssue("ROY-1", 1, "Urgent"),
			createWorkflowIssue("ROY-2", 2, "High"),
			createWorkflowIssue("ROY-3", 3, "Medium"),
		];
		const discoveredPullRequestsByIssueKey = new Map([
			[
				"ROY-2",
				{
					branch: "codex/roy-2",
					title: "PR",
					url: "https://github.com/acme/repo/pull/2",
				},
			],
			["ROY-3", undefined],
		]);

		const result = buildReviewOnlyIssueQueue({
			runStates,
			localIssues,
			linearIssues,
			discoveredPullRequestsByIssueKey,
		});

		expect(result.issueQueue.map((issue) => issue.identifier)).toEqual([
			"ROY-1",
			"ROY-2",
		]);
		expect(result.mergedCandidateCount).toBe(3);
		expect(result.discoveredPrCount).toBe(1);
		expect(result.skippedWithoutPr).toBe(1);
	});

	it("resolves review-only bootstrap stage from issue state mapping", () => {
		const statusMap = {
			...createProject("default").linear.statusMap,
			pr_created: "PR Created",
			reviewing: "In Review",
			testing: "Testing",
		};
		expect(
			resolveReviewOnlyBootstrapStage(
				{ id: "unknown", name: "In Review" },
				statusMap,
			),
		).toBe("reviewing");
		expect(
			resolveReviewOnlyBootstrapStage(
				{ id: "in review", name: "Whatever" },
				{
					...statusMap,
					pr_created: "In Review",
				},
			),
		).toBe("pr_created");
		expect(
			resolveReviewOnlyBootstrapStage(
				{ id: "unknown", name: "Something else" },
				statusMap,
			),
		).toBe("testing");
		expect(
			resolveReviewOnlyBootstrapStage(
				{ id: "unknown", name: "Done" },
				statusMap,
			),
		).toBe("done");
	});
});

describe("isReviewOnlyExecutableStage", () => {
	it("only allows review-related stages", () => {
		expect(isReviewOnlyExecutableStage("pr_created")).toBe(true);
		expect(isReviewOnlyExecutableStage("reviewing")).toBe(true);
		expect(isReviewOnlyExecutableStage("testing")).toBe(true);
		expect(isReviewOnlyExecutableStage("done")).toBe(true);
		expect(isReviewOnlyExecutableStage("implementing")).toBe(false);
		expect(isReviewOnlyExecutableStage("human_review")).toBe(false);
		expect(isReviewOnlyExecutableStage("planning")).toBe(false);
		expect(isReviewOnlyExecutableStage("received")).toBe(false);
	});
});

describe("isReviewOnlyEligibleRunState", () => {
	it("includes done states with unmerged PRs", () => {
		const state = createRunState("ENG-90", "done", Date.now());
		state.pullRequest = {
			branch: "codex/eng-90",
			title: "ENG-90",
			url: "https://github.com/acme/repo/pull/90",
		};

		expect(isReviewOnlyEligibleRunState(state)).toBe(true);
	});

	it("excludes done states after automated PR action or human notification", () => {
		const completed = createRunState("ENG-91", "done", Date.now());
		completed.pullRequest = {
			branch: "codex/eng-91",
			title: "ENG-91",
			url: "https://github.com/acme/repo/pull/91",
		};
		completed.pullRequestApprovedAt = "2026-05-07T12:00:00.000Z";

		const notified = createRunState("ENG-92", "done", Date.now());
		notified.pullRequest = {
			branch: "codex/eng-92",
			title: "ENG-92",
			url: "https://github.com/acme/repo/pull/92",
		};
		notified.humanReviewNotifiedAt = "2026-05-07T12:00:00.000Z";

		expect(isReviewOnlyEligibleRunState(completed)).toBe(false);
		expect(isReviewOnlyEligibleRunState(notified)).toBe(false);
	});
});

describe("withExecutionPathLock", () => {
	it("serializes execution for the same path", async () => {
		const events: string[] = [];

		await Promise.all([
			withExecutionPathLock("/tmp/shared", async () => {
				events.push("a:start");
				await new Promise((resolve) => setTimeout(resolve, 5));
				events.push("a:end");
			}),
			withExecutionPathLock("/tmp/shared", async () => {
				events.push("b:start");
				events.push("b:end");
			}),
		]);

		expect(events).toEqual(["a:start", "a:end", "b:start", "b:end"]);
	});

	it("allows acquiring a fresh lease after queue wait exceeds timeout", async () => {
		const leaseTimeoutMs = 5;
		const waitMs = 20;
		const startedAtMs = Date.now();
		const state = createRunState("ROY-6", "reviewing", startedAtMs);

		await Promise.all([
			withExecutionPathLock("/tmp/shared-timeout", async () => {
				await new Promise((resolve) => setTimeout(resolve, waitMs));
			}),
			withExecutionPathLock("/tmp/shared-timeout", async () => {
				const acquiredAtMs = Date.now();
				expect(acquiredAtMs - startedAtMs).toBeGreaterThanOrEqual(waitMs);

				const leased = applyRunLease(
					state,
					"worker-queued",
					leaseTimeoutMs,
					acquiredAtMs,
				);
				expect(isRunLeaseExpired(leased, acquiredAtMs)).toBe(false);
			}),
		]);
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
		expect(shouldRetryRunStage("human_review")).toBe(false);
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

describe("runAgentWithChatLog", () => {
	it("records successful agent runs", async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-log-"),
		);
		const result = await runAgentWithChatLog({
			workspacePath: workspace,
			projectId: "default",
			issue: {
				id: "lin_123",
				key: "ENG-1",
				title: "Capture logs",
				url: "https://linear.app/acme/issue/ENG-1/capture-logs",
			},
			agentRole: "planning",
			skillPath: "skills/piv-plan/SKILL.md",
			prompt: "plan prompt",
			invoke: async () => ({
				sessionId: "session-1",
				finalMessage: "plan done",
				stdout: "stdout payload",
				usage: {
					inputTokens: 10,
					outputTokens: 4,
					totalTokens: 14,
				},
			}),
		});

		expect(result.finalMessage).toBe("plan done");

		const file = agentChatLogPath(
			workspace,
			"default",
			"planning",
			"skills/piv-plan/SKILL.md",
		);
		const raw = await readFile(file, "utf8");
		const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			projectId: "default",
			issueKey: "ENG-1",
			agentRole: "planning",
			skillPath: "skills/piv-plan/SKILL.md",
			prompt: "plan prompt",
			finalMessage: "plan done",
			stdout: "stdout payload",
			sessionId: "session-1",
			success: true,
		});
		expect(typeof entries[0]?.recordedAt).toBe("string");
	});

	it("records failed agent runs and rethrows", async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-log-"),
		);
		const invoke = async () => {
			throw new Error("agent failed");
		};
		await expect(
			runAgentWithChatLog({
				workspacePath: workspace,
				projectId: "default",
				issue: {
					id: "lin_123",
					key: "ENG-2",
					title: "Capture failures",
					url: "https://linear.app/acme/issue/ENG-2/capture-failures",
				},
				agentRole: "review-testing",
				skillPath: "skills/piv-review-test/SKILL.md",
				prompt: "review prompt",
				invoke,
			}),
		).rejects.toThrow("agent failed");

		const file = agentChatLogPath(
			workspace,
			"default",
			"review-testing",
			"skills/piv-review-test/SKILL.md",
		);
		const raw = await readFile(file, "utf8");
		const entries = JSON.parse(raw) as Array<Record<string, unknown>>;
		expect(entries).toHaveLength(1);
		expect(entries[0]).toMatchObject({
			projectId: "default",
			issueKey: "ENG-2",
			agentRole: "review-testing",
			prompt: "review prompt",
			success: false,
			error: "agent failed",
			finalMessage: "",
			stdout: "",
		});
	});
});

describe("readyPullRequestAfterPassingReview", () => {
	it("marks PR as ready only when review passed", async () => {
		const markPrReady = mock(async () => true);
		const updated = await readyPullRequestAfterPassingReview(
			createProject("default"),
			{
				branch: "codex/eng-1",
				title: "PR",
				url: "https://github.com/acme/repo/pull/1",
			},
			true,
			{
				markPrReadyForReview: markPrReady,
			},
		);

		expect(updated).toBe(true);
		expect(markPrReady).toHaveBeenCalledTimes(1);
	});

	it("does not mark PR as ready when review failed", async () => {
		const markPrReady = mock(async () => true);
		const updated = await readyPullRequestAfterPassingReview(
			createProject("default"),
			{
				branch: "codex/eng-1",
				title: "PR",
				url: "https://github.com/acme/repo/pull/1",
			},
			false,
			{
				markPrReadyForReview: markPrReady,
			},
		);

		expect(updated).toBe(false);
		expect(markPrReady).not.toHaveBeenCalled();
	});

	it("does not mark PR as ready in dry-run mode", async () => {
		const markPrReady = mock(async () => true);
		const updated = await readyPullRequestAfterPassingReview(
			{ ...createProject("default"), dryRun: true },
			{
				branch: "codex/eng-1",
				title: "PR",
				url: "https://github.com/acme/repo/pull/1",
			},
			true,
			{
				markPrReadyForReview: markPrReady,
			},
		);

		expect(updated).toBe(false);
		expect(markPrReady).not.toHaveBeenCalled();
	});
});

describe("review pass stage transitions", () => {
	it("keeps Linear in reviewing after a passing review result", async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), "adhd-review-pass-"),
		);
		const state = createRunState("ENG-100", "reviewing", Date.now());
		state.pullRequest = {
			branch: "codex/eng-100",
			title: "ENG-100",
			url: "https://github.com/acme/repo/pull/100",
		};
		const config = {
			...createProject("default"),
			workspacePath: workspace,
			dryRun: true,
		};
		const notifications = {
			email: { enabled: false, to: [] },
		};
		const agent = {
			runPlan: async () => {
				throw new Error("unused");
			},
			resume: async () => {
				throw new Error("unused");
			},
			runReview: async () => ({
				finalMessage: "RESULT: PASS\nSUMMARY: good\nBUGS_JSON: []",
				stdout: "",
				usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
			}),
		};
		const markStage = mock(async () => {});
		const applyStageLabel = mock(async () => {});
		const comment = mock(async () => {});
		const linear = {
			markStage,
			applyStageLabel,
			comment,
		};

		await handleReviewTestingStage(
			config,
			agent,
			notifications,
			linear as never,
			state,
		);

		expect(state.stage).toBe("done");
		expect(markStage).toHaveBeenCalledWith("lin_ENG-100", "testing");
		expect(markStage).toHaveBeenCalledWith("lin_ENG-100", "reviewing");
		expect(markStage).not.toHaveBeenCalledWith("lin_ENG-100", "done");
		expect(applyStageLabel).toHaveBeenCalledWith("lin_ENG-100", "testing");
		expect(applyStageLabel).toHaveBeenCalledWith("lin_ENG-100", "reviewing");
		expect(comment).toHaveBeenCalledWith(
			"lin_ENG-100",
			"Review/testing passed. PR is ready and issue remains in review until merge.",
		);
	});
});

describe("review-only done-stage merge finalization", () => {
	it("moves Linear to done only after merge finalization", async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), "adhd-review-merge-"),
		);
		const state = createRunState("ENG-101", "done", Date.now());
		state.pullRequest = {
			branch: "codex/eng-101",
			title: "ENG-101",
			url: "https://github.com/acme/repo/pull/101",
		};
		const config = {
			...createProject("default"),
			workspacePath: workspace,
		};
		const notifications = {
			email: { enabled: false, to: [] },
		};
		const markStage = mock(async () => {});
		const clearWorkflowStageLabels = mock(async () => {});
		const comment = mock(async () => {});
		const linear = {
			markStage,
			clearWorkflowStageLabels,
			comment,
		};

		await finalizeIssueAfterReviewMerge(
			config,
			notifications,
			linear as never,
			state,
		);

		expect(state.pullRequestApprovedAt).toBeDefined();
		expect(markStage).toHaveBeenCalledWith("lin_ENG-101", "done");
		expect(clearWorkflowStageLabels).toHaveBeenCalledWith("lin_ENG-101");
		expect(comment).toHaveBeenCalledWith(
			"lin_ENG-101",
			"PR squash-merged after completed review.",
		);
	});

	it("does not persist pullRequestApprovedAt when Linear finalization fails", async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), "adhd-review-merge-fail-"),
		);
		const state = createRunState("ENG-102", "done", Date.now());
		state.pullRequest = {
			branch: "codex/eng-102",
			title: "ENG-102",
			url: "https://github.com/acme/repo/pull/102",
		};
		const config = {
			...createProject("default"),
			workspacePath: workspace,
		};
		const notifications = {
			email: { enabled: false, to: [] },
		};
		const markStage = mock(async () => {
			throw new Error("Linear unavailable");
		});
		const clearWorkflowStageLabels = mock(async () => {});
		const comment = mock(async () => {});
		const linear = {
			markStage,
			clearWorkflowStageLabels,
			comment,
		};

		await expect(
			finalizeIssueAfterReviewMerge(
				config,
				notifications,
				linear as never,
				state,
			),
		).rejects.toThrow("Linear unavailable");
		expect(state.pullRequestApprovedAt).toBeUndefined();
		expect(clearWorkflowStageLabels).not.toHaveBeenCalled();
		expect(comment).not.toHaveBeenCalled();
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
			complexityScore: 4,
		});
	});

	it("parses COMPLEX with valid split task JSON", () => {
		const result = parsePlannerDecision(
			[
				"COMPLEXITY: COMPLEX",
				"COMPLEXITY_SCORE: 4",
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
		expect(result.complexityScore).toBe(4);
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

	it("throws when COMPLEXITY_SCORE is invalid", () => {
		expect(() =>
			parsePlannerDecision(
				["COMPLEXITY: SIMPLE", "COMPLEXITY_SCORE: hard", "scope"].join("\n"),
			),
		).toThrow("Invalid COMPLEXITY_SCORE");
	});
});

describe("handlePlanningStage", () => {
	it("moves the parent issue to backlog after creating split sub-issues", async () => {
		const config = createProject("default");
		const state = createRunState("ROY-80", "planning", Date.now());
		const planSummary = [
			"COMPLEXITY: COMPLEX",
			"COMPLEXITY_SCORE: 7",
			"SPLIT_TASKS_JSON:",
			JSON.stringify([{ title: "Extract API layer" }]),
		].join("\n");
		const agent: AgentAdapter = {
			runPlan: mock(async () => ({
				finalMessage: planSummary,
				stdout: "",
			})),
			resume: mock(async () => ({ finalMessage: "", stdout: "" })),
			runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
		};
		const createTodoIssueFromPlan = mock(async () => ({
			id: "lin_child",
			identifier: "ROY-81",
			title: "[ROY-80] Extract API layer",
			url: "https://linear.app/acme/issue/ROY-81/extract-api-layer",
		}));
		const markStage = mock(async () => {});
		const clearWorkflowStageLabels = mock(async () => {});
		const comment = mock(async () => {});
		const safeNotifyTaskOutcome = mock(async () => {});

		await handlePlanningStage(
			config,
			agent,
			{ email: { enabled: false, to: [] } },
			{
				createTodoIssueFromPlan,
				markStage,
				clearWorkflowStageLabels,
				comment,
				updateIssueDetails: mock(async () => {}),
			} as never,
			state,
			{
				runAgentWithChatLog: async ({ invoke }) => invoke(),
				appendCodexUsage: () => {},
				saveRunState: mock(async () => {}),
				transitionStage,
				safeNotifyTaskOutcome,
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		expect(createTodoIssueFromPlan).toHaveBeenCalledWith(state.issue, {
			title: "Extract API layer",
			description: undefined,
			labels: undefined,
			priority: undefined,
		});
		expect(state.stage).toBe("done");
		expect(markStage).toHaveBeenCalledWith(state.issue.id, "backlog");
		expect(markStage).not.toHaveBeenCalledWith(state.issue.id, "done");
		expect(clearWorkflowStageLabels).toHaveBeenCalledWith(state.issue.id);
		const commentCalls = comment.mock.calls as unknown as [string, string][];
		expect(commentCalls[0]?.[1]).toContain("moved the parent issue to Backlog");
		expect(safeNotifyTaskOutcome).toHaveBeenCalledWith(
			{ email: { enabled: false, to: [] } },
			state,
			"done",
		);
	});
});

describe("parsePlannerComplexityScore", () => {
	it("parses explicit score", () => {
		expect(parsePlannerComplexityScore("COMPLEXITY_SCORE: 3")).toBe(3);
	});

	it("defaults to conservative score when missing", () => {
		expect(parsePlannerComplexityScore("no score marker")).toBe(4);
	});
});

describe("parsePlannerIssueRefinement", () => {
	it("returns null when refinement marker is missing", () => {
		expect(parsePlannerIssueRefinement("no refinement provided")).toBeNull();
	});

	it("parses valid refinement payload", () => {
		const result = parsePlannerIssueRefinement(
			[
				"ISSUE_REFINEMENT_JSON:",
				"```json",
				JSON.stringify(
					{
						title: "Refined issue title",
						description: "Refined issue description",
					},
					null,
					2,
				),
				"```",
			].join("\n"),
		);
		expect(result).toEqual({
			title: "Refined issue title",
			description: "Refined issue description",
		});
	});

	it("throws when refinement marker is present but object payload is missing", () => {
		expect(() =>
			parsePlannerIssueRefinement(
				["ISSUE_REFINEMENT_JSON:", "```json", "{", "```"].join("\n"),
			),
		).toThrow("must contain a JSON object");
	});

	it("throws when title or description is empty", () => {
		expect(() =>
			parsePlannerIssueRefinement(
				[
					"ISSUE_REFINEMENT_JSON:",
					JSON.stringify({ title: "", description: "desc" }),
				].join("\n"),
			),
		).toThrow("title must be a non-empty string");

		expect(() =>
			parsePlannerIssueRefinement(
				[
					"ISSUE_REFINEMENT_JSON:",
					JSON.stringify({ title: "Title", description: "   " }),
				].join("\n"),
			),
		).toThrow("description must be a non-empty string");
	});
});

describe("applyPlannerIssueRefinement", () => {
	it("updates Linear issue details and mutates run-state issue when changed", async () => {
		const updateIssueDetails = mock(async () => {});
		const issue: IssueRef = {
			id: "lin_1",
			key: "ROY-1",
			title: "Raw issue",
			description: "Raw description",
			url: "https://linear.app/roy/issue/ROY-1/raw-issue",
		};

		const changed = await applyPlannerIssueRefinement(
			{ updateIssueDetails },
			issue,
			[
				"ISSUE_REFINEMENT_JSON:",
				JSON.stringify({
					title: "Refined issue",
					description: "Refined description",
				}),
			].join("\n"),
		);

		expect(changed).toBe(true);
		expect(updateIssueDetails).toHaveBeenCalledTimes(1);
		expect(updateIssueDetails).toHaveBeenCalledWith(
			"lin_1",
			"Refined issue",
			"Refined description",
		);
		expect(issue.title).toBe("Refined issue");
		expect(issue.description).toBe("Refined description");
	});

	it("skips update when refinement marker is absent or values are unchanged", async () => {
		const updateIssueDetails = mock(async () => {});
		const issue: IssueRef = {
			id: "lin_2",
			key: "ROY-2",
			title: "Existing title",
			description: "Existing description",
			url: "https://linear.app/roy/issue/ROY-2/existing-title",
		};

		const noMarkerChanged = await applyPlannerIssueRefinement(
			{ updateIssueDetails },
			issue,
			"Scope summary only.",
		);
		const unchangedChanged = await applyPlannerIssueRefinement(
			{ updateIssueDetails },
			issue,
			[
				"ISSUE_REFINEMENT_JSON:",
				JSON.stringify({
					title: "Existing title",
					description: "Existing description",
				}),
			].join("\n"),
		);

		expect(noMarkerChanged).toBe(false);
		expect(unchangedChanged).toBe(false);
		expect(updateIssueDetails).toHaveBeenCalledTimes(0);
	});
});

describe("planner routing with missing score", () => {
	it("routes simple plans without score to bot review mode", () => {
		const decision = parsePlannerDecision(
			["COMPLEXITY: SIMPLE", "scope summary", "implementation steps"].join(
				"\n",
			),
		);
		expect(resolveReviewModeForComplexityScore(decision.complexityScore)).toBe(
			"bot",
		);
	});
});

describe("resolveReviewModeForComplexityScore", () => {
	it("uses bot review for scores below threshold", () => {
		expect(resolveReviewModeForComplexityScore(0)).toBe("bot");
		expect(resolveReviewModeForComplexityScore(4)).toBe("bot");
	});

	it("uses human review for threshold and above", () => {
		expect(resolveReviewModeForComplexityScore(5)).toBe("human");
		expect(resolveReviewModeForComplexityScore(10)).toBe("human");
	});
});

describe("shouldSquashMergePullRequestForComplexityScore", () => {
	it("allows automated PR merge only below the human review threshold", () => {
		expect(shouldSquashMergePullRequestForComplexityScore(0)).toBe(true);
		expect(shouldSquashMergePullRequestForComplexityScore(4)).toBe(true);
		expect(shouldSquashMergePullRequestForComplexityScore(5)).toBe(false);
		expect(shouldSquashMergePullRequestForComplexityScore(10)).toBe(false);
	});
});

describe("resolveReviewFailureStage", () => {
	it("routes to implementing when codex session is present", () => {
		expect(resolveReviewFailureStage({ codexSessionId: "session-1" })).toBe(
			"implementing",
		);
	});

	it("routes to human_review when codex session is missing", () => {
		expect(resolveReviewFailureStage({ codexSessionId: undefined })).toBe(
			"human_review",
		);
	});
});

describe("shouldSkipReviewOnlyRunState", () => {
	it("skips existing human_review states in review-only mode", () => {
		expect(
			shouldSkipReviewOnlyRunState(
				{ stage: "human_review" },
				{ reviewOnly: true },
			),
		).toBe(true);
	});

	it("does not skip non-human-review states in review-only mode", () => {
		expect(
			shouldSkipReviewOnlyRunState(
				{ stage: "reviewing" },
				{ reviewOnly: true },
			),
		).toBe(false);
	});

	it("does not skip when review-only mode is disabled", () => {
		expect(
			shouldSkipReviewOnlyRunState(
				{ stage: "human_review" },
				{ reviewOnly: false },
			),
		).toBe(false);
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
				backlog: "Backlog",
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

function createWorkflowIssue(
	identifier: string,
	priorityValue: number,
	priorityName: string,
) {
	return {
		id: identifier,
		identifier,
		title: identifier,
		url: `https://linear.app/acme/issue/${identifier}/sample`,
		priority: {
			value: priorityValue,
			name: priorityName,
		},
		labels: [],
		state: {
			id: "state_assigned",
			name: "Todo",
		},
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
