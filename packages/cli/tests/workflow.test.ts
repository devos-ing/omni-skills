import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { stripVTControlCharacters } from "node:util";
import type { AgentAdapter } from "adapters";
import { handleRunCommand } from "../src/features/commands/issues/run-command";
import type { LoadedConfig } from "../src/features/config";
import type {
	PollingConfig,
	ResolvedProjectConfig,
	RunState,
} from "../src/features/types";
import { runAgentWithChatLog } from "../src/features/workflow/agents/agent-chat-log";
import {
	fixedBugsForImplementationComment,
	prepareImplementationBranchForStage,
} from "../src/features/workflow/implementation/implement-stage";
import { buildPrioritizedIssueQueue } from "../src/features/workflow/management/issue-queue-builder";
import {
	resolvePollingSettings,
	shouldStopPolling,
	sleep,
} from "../src/features/workflow/management/polling-settings";
import { resolveEffectiveIssueConcurrency } from "../src/features/workflow/management/project-cycle-runner";
import { routeProjectsForIssueProjectId } from "../src/features/workflow/management/project-routing";
import {
	isRunStateStaleForRetry,
	selectStaleRunIssueKeys,
} from "../src/features/workflow/management/stale-run-retry";
import { buildIssueJobLogFields } from "../src/features/workflow/mission/issue-job-log-fields";
import { resolveReviewOnlyBootstrapStage } from "../src/features/workflow/mission/issue-run-state-resolver";
import { handlePlanningStage } from "../src/features/workflow/planning/plan";
import {
	resolveReviewModeForComplexityScore,
	shouldSquashMergePullRequestForComplexityScore,
} from "../src/features/workflow/planning/plan";
import {
	parsePlannerComplexityScore,
	parsePlannerDecision,
	parsePlannerQuestions,
	parsePlannerSuccessGoal,
} from "../src/features/workflow/planning/plan-parsing";
import {
	finalizeIssueAfterReviewMerge,
	handleReviewTestingStage,
} from "../src/features/workflow/review/review-orchestrator";
import {
	normalizeFailedReviewBugs,
	readyPullRequestAfterPassingReview,
	resolveReviewFailureStage,
} from "../src/features/workflow/review/review-stage-helpers";
import { withExecutionPathLock } from "../src/features/workflow/runtime/execution-path-lock";
import {
	cleanupTerminalIsolatedWorktree,
	isolatedWorktreePath,
	prepareIsolatedExecutionConfig,
	prepareIsolatedExecutionWorkspace,
	shouldUseIsolatedWorktree,
} from "../src/features/workflow/runtime/workflow-worktree";
import {
	normalizeBlockedPlanningFailureForResume,
	saveRunState,
	stateFilePath,
	transitionStage,
} from "../src/features/workflow/state";
import { agentChatLogPath } from "../src/features/workflow/state-chat-log";
import { projectErrorLogPath } from "../src/features/workflow/state-error-log";
import {
	applyRunLease,
	isRunLeaseExpired,
} from "../src/features/workflow/state-lease";
import type { WorkflowRuntime } from "../src/features/workflow/types/workflow.types";
import {
	enrichUsageRecord,
	estimateUsageCostMicrousd,
} from "../src/features/workflow/usage-cost";
import { appendCodexUsage } from "../src/features/workflow/usage/usage-state";
import { runWorkflow } from "../src/features/workflow/workflow";
import { buildRunLeaseOwnerId } from "../src/features/workflow/workflow-lease";
import {
	buildReviewOnlyIssueQueue,
	isReviewOnlyEligibleRunState,
	isReviewOnlyExecutableStage,
	selectIssueQueueForCycle,
	selectReviewOnlyIssueKeys,
	shouldRetryRunStage,
	shouldSkipReviewOnlyRunState,
} from "../src/features/workflow/workflow-queue";
import { processIssueQueueBounded } from "../src/features/workflow/workflow-queue";

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

	it("treats poll-forever as polling with no max cycle or idle exit", () => {
		const settings = resolvePollingSettings(polling, {
			pollForever: true,
		});
		expect(settings).toEqual({
			enabled: true,
			intervalMs: 30000,
			maxCycles: undefined,
			exitWhenIdle: false,
			staleRunTimeoutMs: 3600000,
		});
	});

	it("keeps polling helpers available from their owner module", () => {
		expect(typeof resolvePollingSettings).toBe("function");
		expect(typeof shouldStopPolling).toBe("function");
		expect(typeof sleep).toBe("function");
	});
});

describe("runWorkflow no-project polling", () => {
	it("returns immediately when no projects are configured outside poll-forever", async () => {
		const createTaskClient = mock();
		const runtime = { createTaskClient } as unknown as WorkflowRuntime;

		await runWorkflow(
			createLoadedConfigWithProjects([]),
			{ poll: true },
			runtime,
		);

		expect(createTaskClient).not.toHaveBeenCalled();
	});

	it("keeps poll-forever alive when no projects are configured", async () => {
		const stopped = new Error("stop after first no-project sleep");
		const sleepCalls: number[] = [];
		const runtime = {
			createTaskClient: mock(),
			sleep: mock(async (ms: number) => {
				sleepCalls.push(ms);
				throw stopped;
			}),
		} as unknown as WorkflowRuntime;

		await expect(
			runWorkflow(
				createLoadedConfigWithProjects([]),
				{ pollForever: true },
				runtime,
			),
		).rejects.toThrow(stopped);

		expect(sleepCalls).toEqual([1]);
	});
});

describe("workflow run visibility", () => {
	it("logs run startup before workflow polling begins", async () => {
		const output = await captureStderr(() =>
			handleRunCommand(createLoadedConfigWithProjects([]), {
				poll: true,
				maxPollCycles: 1,
				pollIntervalMs: 123,
			}),
		);

		expect(output).toContain("INFO  Starting workflow run");
		expect(output).toContain("scope=server-projects");
		expect(output).toContain("projectSource=server");
		expect(output).not.toContain("projectCount=");
		expect(output).toContain("pollingEnabled=true");
		expect(output).toContain("maxPollCycles=1");
		expect(output).toContain("pollIntervalMs=123");
		expect(output).toContain(
			"workflowDataUrl=ws://127.0.0.1:3001/api/workflow",
		);
	});

	it("logs cycle start and no-work progress around an empty poll", async () => {
		const linear = { fetchWork: mock(async () => []) };
		const runtime = {
			createTaskClient: mock(() => linear),
		} as unknown as WorkflowRuntime;

		const output = await captureStderr(() =>
			runWorkflow(createLoadedConfig(createProject("default")), {}, runtime),
		);

		expect(output).toContain("INFO  Starting workflow polling cycle");
		expect(output).toContain("projectId=default");
		expect(output).toContain("cycle=1");
		expect(output).toContain("pollingEnabled=false");
		expect(output).toContain("INFO  Fetched eligible board tasks");
		expect(output).toContain("issueCount=0");
		expect(output).toContain("INFO  No eligible board tasks found.");
	});

	it("warns when workflow data reporting cannot connect", async () => {
		const socket = installFailingWorkflowPollingSocket();
		const linear = { fetchWork: mock(async () => []) };
		const runtime = {
			createTaskClient: mock(() => linear),
		} as unknown as WorkflowRuntime;

		try {
			const output = await captureStderr(() =>
				runWorkflow(
					createLoadedConfig(createProject("default")),
					{ poll: true, maxPollCycles: 1 },
					runtime,
				),
			);

			expect(output).toContain("WARN  Workflow data reporting unavailable");
			expect(output).toContain("action=polling.record");
			expect(output).toContain("Start devos server/daemon");
		} finally {
			socket.restore();
		}
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

describe("resolveEffectiveIssueConcurrency", () => {
	it("uses run options before project defaults", () => {
		const config = createProject("default");
		config.workflow.issueConcurrency = 1;

		expect(resolveEffectiveIssueConcurrency(config, {})).toBe(1);
		expect(resolveEffectiveIssueConcurrency(config, { concurrency: 3 })).toBe(
			3,
		);
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
				...createRunState("ROY-1", "in_review", now),
				pullRequest: {
					branch: "codex/roy-1",
					title: "PR",
					url: "https://pr/1",
				},
			},
			{
				...createRunState("ROY-2", "in_review", now),
				pullRequest: {
					branch: "codex/roy-2",
					title: "PR",
					url: "https://pr/2",
				},
			},
			{
				...createRunState("ROY-3", "in_review", now),
				pullRequest: {
					branch: "codex/roy-3",
					title: "PR",
					url: "https://pr/3",
				},
			},
			{
				...createRunState("ROY-4", "in_review", now),
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
			createRunState("ROY-7", "in_progress", now),
		];

		expect(selectReviewOnlyIssueKeys(runStates)).toEqual([
			"ROY-1",
			"ROY-2",
			"ROY-3",
			"ROY-5",
		]);
	});

	it("merges local and task review-only candidates and skips missing PRs", () => {
		const now = Date.parse("2026-05-07T12:00:00.000Z");
		const runStates: RunState[] = [
			{
				...createRunState("ROY-1", "in_review", now),
				pullRequest: {
					branch: "codex/roy-1",
					title: "PR",
					url: "https://github.com/acme/repo/pull/1",
				},
			},
		];
		const localIssues = [createWorkflowIssue("ROY-1", 2, "High")];
		const taskIssues = [
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
			taskIssues,
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
		expect(
			resolveReviewOnlyBootstrapStage({ id: "unknown", name: "In Review" }),
		).toBe("in_review");
		expect(
			resolveReviewOnlyBootstrapStage({ id: "in review", name: "Whatever" }),
		).toBe("in_review");
		expect(
			resolveReviewOnlyBootstrapStage({
				id: "unknown",
				name: "Something else",
			}),
		).toBe("in_review");
		expect(
			resolveReviewOnlyBootstrapStage({ id: "unknown", name: "Done" }),
		).toBe("done");
	});
});

describe("normalizeBlockedPlanningFailureForResume", () => {
	it("resets blocked planning failures while preserving diagnostic fields", () => {
		const state = {
			...createRunState("ROY-70", "blocked", Date.now()),
			failedStage: "plan" as const,
			planSummary: "invalid plan",
			successGoal: "stale goal",
			complexityScore: 8,
			reviewMode: "human" as const,
			lastError: "Planner output must include SUCCESS_GOAL",
			codexUsage: [
				{
					stage: "planning" as const,
					inputTokens: 1,
					outputTokens: 2,
					totalTokens: 3,
					recordedAt: "2026-05-13T00:00:00.000Z",
				},
			],
		};

		const normalized = normalizeBlockedPlanningFailureForResume(state);

		expect(normalized.stage).toBe("plan");
		expect(normalized.planSummary).toBeUndefined();
		expect(normalized.successGoal).toBeUndefined();
		expect(normalized.complexityScore).toBeUndefined();
		expect(normalized.reviewMode).toBeUndefined();
		expect(normalized.issue).toBe(state.issue);
		expect(normalized.lastError).toBe(state.lastError);
		expect(normalized.codexUsage).toBe(state.codexUsage);
	});

	it("resets legacy blocked planner validation failures", () => {
		const state = {
			...createRunState("ROY-71", "blocked", Date.now()),
			planSummary: "`SUCCESS_GOAL: wrapped marker`",
			lastError:
				"Planner output must include SUCCESS_GOAL with a concise acceptance goal.",
		};

		expect(normalizeBlockedPlanningFailureForResume(state).stage).toBe("plan");
	});

	it("leaves non-planning blocked failures terminal", () => {
		const state = {
			...createRunState("ROY-72", "blocked", Date.now()),
			failedStage: "in_progress" as const,
			lastError: "implementation failed",
		};

		expect(normalizeBlockedPlanningFailureForResume(state).stage).toBe(
			"failed",
		);
	});
});

describe("isReviewOnlyExecutableStage", () => {
	it("only allows review-related stages", () => {
		expect(isReviewOnlyExecutableStage("in_review")).toBe(true);
		expect(isReviewOnlyExecutableStage("done")).toBe(true);
		expect(isReviewOnlyExecutableStage("in_progress")).toBe(false);
		expect(isReviewOnlyExecutableStage("canceled")).toBe(false);
		expect(isReviewOnlyExecutableStage("plan")).toBe(false);
		expect(isReviewOnlyExecutableStage("backlog")).toBe(false);
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
		const state = createRunState("ROY-6", "in_review", startedAtMs);

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

describe("processIssueQueueBounded", () => {
	it("processes sequentially by default", async () => {
		const events: string[] = [];
		await processIssueQueueBounded([1, 2, 3], undefined, async (issue) => {
			events.push(`start:${issue}`);
			await new Promise((resolve) => setTimeout(resolve, 5));
			events.push(`end:${issue}`);
		});
		expect(events).toEqual([
			"start:1",
			"end:1",
			"start:2",
			"end:2",
			"start:3",
			"end:3",
		]);
	});

	it("respects concurrency bounds above one", async () => {
		const starts: number[] = [];
		let running = 0;
		let maxRunning = 0;
		const release: Array<() => void> = [];

		const done = processIssueQueueBounded([1, 2, 3], 2, async (issue) => {
			starts.push(issue);
			running += 1;
			maxRunning = Math.max(maxRunning, running);
			await new Promise<void>((resolve) => {
				release.push(resolve);
			});
			running -= 1;
		});

		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(starts).toEqual([1, 2]);
		expect(maxRunning).toBe(2);
		release.shift()?.();
		await new Promise((resolve) => setTimeout(resolve, 5));
		expect(starts).toEqual([1, 2, 3]);
		while (release.length > 0) {
			release.shift()?.();
		}
		await done;
	});

	it("starts each queue item once while running workers in parallel", async () => {
		const starts: number[] = [];
		const seen = new Set<number>();
		let running = 0;
		let maxRunning = 0;
		let releaseGate!: () => void;
		const gate = new Promise<void>((resolve) => {
			releaseGate = resolve;
		});

		await processIssueQueueBounded([1, 2, 3, 4], 2, async (issue) => {
			starts.push(issue);
			expect(seen.has(issue)).toBe(false);
			seen.add(issue);
			running += 1;
			maxRunning = Math.max(maxRunning, running);
			if (maxRunning === 2) {
				releaseGate();
			}
			await gate;
			running -= 1;
		});

		expect(maxRunning).toBe(2);
		expect(starts.slice().sort((a, b) => a - b)).toEqual([1, 2, 3, 4]);
		expect(seen.size).toBe(4);
	});
});

describe("runWorkflow parallel issue regression", () => {
	it("requests unprojected tasks during default server-project polling", async () => {
		const { restore } = installWorkflowPollingSocket();
		const fetchCalls: Array<{
			projectId: string;
			issueArg: string | undefined;
			options: unknown;
		}> = [];
		const projects = [createProject("api"), createProject("web")];
		const runtime = {
			createTaskClient: (config: ResolvedProjectConfig) =>
				({
					fetchWork: mock(async (issueArg, options) => {
						fetchCalls.push({
							projectId: config.id,
							issueArg,
							options,
						});
						return [];
					}),
				}) as unknown,
		} as unknown as WorkflowRuntime;

		try {
			await runWorkflow(
				{
					...createLoadedConfig(projects[0] as ResolvedProjectConfig),
					projects,
				},
				{ poll: true },
				runtime,
			);

			expect(fetchCalls).toEqual([
				{
					projectId: "api",
					issueArg: undefined,
					options: { includeUnprojected: true },
				},
				{
					projectId: "web",
					issueArg: undefined,
					options: { includeUnprojected: true },
				},
			]);
		} finally {
			restore();
		}
	});

	it("records CLI polling cycle status and events", async () => {
		const { calls, restore } = installWorkflowPollingSocket();
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-polling-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		config.server.database.databasePath = path.join(workspacePath, "server-db");
		const runtime = {
			createTaskClient: () =>
				({
					fetchWork: mock(async () => []),
				}) as unknown,
		} as unknown as WorkflowRuntime;

		try {
			await runWorkflow(createLoadedConfig(config), { poll: true }, runtime);

			expect(calls.map((call) => call.eventType)).toEqual([
				"cycle_started",
				"cycle_completed",
				"polling_stopped",
			]);
			expect(
				calls.find((call) => call.eventType === "cycle_completed"),
			).toMatchObject({
				pollerId: "tasks:default",
				state: "success",
				counts: { issueCount: 0, staleRetryCount: 0 },
				consecutiveFailures: 0,
			});
		} finally {
			restore();
		}
	});

	it("records CLI polling errors without replacing project error logs", async () => {
		const { calls, restore } = installWorkflowPollingSocket();
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-polling-error-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		config.server.database.databasePath = path.join(workspacePath, "server-db");
		const runtime = {
			createTaskClient: () =>
				({
					fetchWork: mock(async () => {
						throw new Error("Linear unavailable");
					}),
				}) as unknown,
		} as unknown as WorkflowRuntime;

		try {
			await runWorkflow(createLoadedConfig(config), { poll: true }, runtime);

			const errorLog = await readFile(
				projectErrorLogPath(config.workspacePath, config.id),
				"utf8",
			);
			expect(
				calls.find((call) => call.eventType === "cycle_failed"),
			).toMatchObject({
				lastError: "Linear unavailable",
				consecutiveFailures: 1,
			});
			expect(errorLog).toContain("Linear unavailable");
		} finally {
			restore();
		}
	});

	it("processes multiple issues with concurrency and prepares isolated paths per issue", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-parallel-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		config.workflow.issueConcurrency = 2;

		await saveRunState(
			workspacePath,
			createRunState("ENG-1", "in_review", Date.now()),
		);
		await saveRunState(
			workspacePath,
			createRunState("ENG-2", "in_review", Date.now()),
		);

		const issues = [
			{ ...createWorkflowIssue("ENG-1", 1, "Urgent"), id: "lin_ENG-1" },
			{ ...createWorkflowIssue("ENG-2", 2, "High"), id: "lin_ENG-2" },
		];
		const ensureIssueWorktreeCalls: string[] = [];
		const prepareDependenciesCalls: string[] = [];
		const isolatedExecutionStarts: string[] = [];
		const isolatedExecutionReleases: Array<() => void> = [];
		let isolatedActive = 0;
		let isolatedMaxActive = 0;

		const runtime = {
			createTaskClient: () =>
				({
					fetchWork: mock(async () => issues),
					isAssignedState: mock(async () => true),
				}) as unknown,
			createAgentAdapter: () => ({}) as AgentAdapter,
			ensureBaseBranchFresh: mock(
				async (projectConfig: ResolvedProjectConfig) => {
					if (!projectConfig.executionPath.includes("/worktrees/")) {
						return;
					}
					isolatedExecutionStarts.push(projectConfig.executionPath);
					isolatedActive += 1;
					isolatedMaxActive = Math.max(isolatedMaxActive, isolatedActive);
					if (isolatedExecutionStarts.length <= 2) {
						await new Promise<void>((resolve) => {
							isolatedExecutionReleases.push(resolve);
							if (isolatedExecutionReleases.length === 2) {
								const pendingReleases = isolatedExecutionReleases.splice(0);
								for (const release of pendingReleases) {
									release();
								}
							}
						});
					}
					isolatedActive -= 1;
				},
			),
			ensureIssueWorktree: mock(
				async (
					_projectConfig: ResolvedProjectConfig,
					_issueKey: string,
					_pullRequest: RunState["pullRequest"],
					worktreePath: string,
				) => {
					ensureIssueWorktreeCalls.push(worktreePath);
					return `codex/${path.basename(worktreePath)}`;
				},
			),
			prepareWorktreeDependencies: mock(async (worktreePath: string) => {
				prepareDependenciesCalls.push(worktreePath);
			}),
			removeIssueWorktree: mock(async () => ({ removed: true })),
		} as unknown as WorkflowRuntime;

		const loadedConfig: LoadedConfig = {
			projects: [config],
			server: config.server,
			polling: {
				intervalMs: 1,
				maxCycles: 1,
				exitWhenIdle: true,
				staleRunTimeoutMs: 60000,
			},
			notifications: {
				email: {
					enabled: false,
					resendApiKey: undefined,
					from: undefined,
					to: [],
				},
			},
			workspace: { id: "owner-1", name: "Default Workspace" },
		};

		await runWorkflow(loadedConfig, {}, runtime);

		expect(isolatedMaxActive).toBe(2);
		expect(
			new Set(ensureIssueWorktreeCalls.map((value) => path.basename(value))),
		).toEqual(new Set(["eng-1", "eng-2"]));
		expect(
			new Set(prepareDependenciesCalls.map((value) => path.basename(value))),
		).toEqual(new Set(["eng-1", "eng-2"]));
	});

	it("skips duplicate processing when an active lease already exists", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-lease-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		config.workflow.issueConcurrency = 2;

		const state = createRunState("ENG-9", "in_review", Date.now());
		state.lease = {
			ownerId: "other-worker",
			acquiredAt: new Date(Date.now() - 2000).toISOString(),
			heartbeatAt: new Date(Date.now() - 1000).toISOString(),
			expiresAt: new Date(Date.now() + 60000).toISOString(),
		};
		await saveRunState(workspacePath, state);

		const ensureIssueWorktree = mock(async () => "codex/eng-9");
		const createAgentAdapter = mock(() => ({}) as AgentAdapter);
		const runtime = {
			createTaskClient: () =>
				({
					fetchWork: mock(async () => [
						{
							...createWorkflowIssue("ENG-9", 1, "Urgent"),
							id: state.issue.id,
						},
					]),
					isAssignedState: mock(async () => true),
				}) as unknown,
			createAgentAdapter,
			ensureBaseBranchFresh: mock(async () => {}),
			ensureIssueWorktree,
			prepareWorktreeDependencies: mock(async () => {}),
			removeIssueWorktree: mock(async () => ({ removed: true })),
		} as unknown as WorkflowRuntime;

		const loadedConfig: LoadedConfig = {
			projects: [config],
			server: config.server,
			polling: {
				intervalMs: 1,
				maxCycles: 1,
				exitWhenIdle: true,
				staleRunTimeoutMs: 60000,
			},
			notifications: {
				email: {
					enabled: false,
					resendApiKey: undefined,
					from: undefined,
					to: [],
				},
			},
			workspace: { id: "owner-1", name: "Default Workspace" },
		};

		await runWorkflow(loadedConfig, {}, runtime);

		expect(ensureIssueWorktree).not.toHaveBeenCalled();
		expect(createAgentAdapter).not.toHaveBeenCalled();
	});

	it("resumes local checkpoint state when the server task id matches", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-resume-same-task-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		const state = createRunState("ENG-59", "in_review", Date.now());
		state.issue.id = "current-task-id";
		await saveRunState(workspacePath, state);
		const createAgentAdapter = mock(() => ({}) as AgentAdapter);

		const output = await captureStderr(() =>
			runWorkflow(createLoadedConfig(config), {}, {
				createTaskClient: () =>
					({
						fetchWork: mock(async () => [
							{
								...createWorkflowIssue("ENG-59", 1, "Urgent"),
								id: "current-task-id",
								title: "Updated server title",
							},
						]),
						isAssignedState: mock(async () => true),
					}) as unknown,
				createAgentAdapter,
				ensureBaseBranchFresh: mock(async () => {}),
			} as unknown as WorkflowRuntime),
		);

		expect(output).toContain("Taking issue job");
		expect(output).toContain("issueKey=ENG-59");
		expect(output).toContain("stage=in_review");
		expect(output).toContain("resumed=true");
		expect(output).not.toContain("Discarding stale local run state");
	});

	it("discards stale blocked run state when the server task id changed", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-resume-new-task-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		const state = createRunState("ENG-60", "blocked", Date.now() - 60000);
		state.issue.id = "old-task-id";
		state.failedStage = "failed";
		state.lastError = "not_found: Task not found";
		state.planSummary = "stale plan";
		state.pullRequest = {
			branch: "codex/eng-60",
			title: "Stale PR",
			url: "https://github.com/acme/repo/pull/60",
		};
		await saveRunState(workspacePath, state);
		const markStage = mock(async (_issueId: string, _stage: string) => {});

		const output = await captureStderr(() =>
			runWorkflow(createLoadedConfig(config), {}, {
				createTaskClient: () =>
					({
						fetchWork: mock(async () => [
							{
								...createWorkflowIssue("ENG-60", 1, "Urgent"),
								id: "new-task-id",
								title: "Fresh server title",
								description: "Fresh server description",
							},
						]),
						isAssignedState: mock(async () => true),
						listChatClarificationAnswers: mock(async () => []),
						publishChatClarification: mock(async () => {}),
						markStage,
						comment: mock(async () => {}),
						clearWorkflowStageLabels: mock(async () => {}),
					}) as unknown,
				createAgentAdapter: () => createNeedsInfoPlanningAgent(),
				ensureBaseBranchFresh: mock(async () => {}),
				sendTaskOutcomeEmail: mock(async () => {}),
			} as unknown as WorkflowRuntime),
		);

		expect(output).toContain("WARN  Discarding stale local run state");
		expect(output).toContain("issueKey=ENG-60");
		expect(output).toContain("previousIssueId=old-task-id");
		expect(output).toContain("issueId=new-task-id");
		expect(output).toContain("Taking issue job");
		expect(output).toContain("stage=brainstorm");
		expect(output).not.toContain("resumed=true");
		expect(markStage).toHaveBeenCalledWith("new-task-id", "canceled");

		const saved = JSON.parse(
			await readFile(stateFilePath(workspacePath, "default", "ENG-60"), "utf8"),
		) as RunState;
		expect(saved.issue).toMatchObject({
			id: "new-task-id",
			key: "ENG-60",
			title: "Fresh server title",
			description: "Fresh server description",
		});
		expect(saved.stage).toBe("canceled");
		expect(saved.failedStage).toBe("plan");
		expect(saved.lastError).toBe(
			"Planning needs clarification before implementation.",
		);
		expect(saved.planSummary).not.toBe("stale plan");
		expect(saved.pullRequest).toBeUndefined();
	});

	it("discards task-not-found blocked state even when the task id already matches", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-resume-found-task-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		const state = createRunState("ENG-61", "blocked", Date.now() - 60000);
		state.issue.id = "current-task-id";
		state.failedStage = "failed";
		state.lastError = "not_found: Task not found";
		state.planSummary = "stale plan";
		await saveRunState(workspacePath, state);
		const markStage = mock(async (_issueId: string, _stage: string) => {});

		const output = await captureStderr(() =>
			runWorkflow(createLoadedConfig(config), {}, {
				createTaskClient: () =>
					({
						fetchWork: mock(async () => [
							{
								...createWorkflowIssue("ENG-61", 1, "Urgent"),
								id: "current-task-id",
								title: "Current server title",
							},
						]),
						isAssignedState: mock(async () => true),
						listChatClarificationAnswers: mock(async () => []),
						publishChatClarification: mock(async () => {}),
						markStage,
						comment: mock(async () => {}),
						clearWorkflowStageLabels: mock(async () => {}),
					}) as unknown,
				createAgentAdapter: () => createNeedsInfoPlanningAgent(),
				ensureBaseBranchFresh: mock(async () => {}),
				sendTaskOutcomeEmail: mock(async () => {}),
			} as unknown as WorkflowRuntime),
		);

		expect(output).toContain(
			"WARN  Discarding stale local run state because server task is available again",
		);
		expect(output).toContain("issueKey=ENG-61");
		expect(output).toContain("stage=brainstorm");
		expect(output).not.toContain("resumed=true");

		const saved = JSON.parse(
			await readFile(stateFilePath(workspacePath, "default", "ENG-61"), "utf8"),
		) as RunState;
		expect(saved.issue).toMatchObject({
			id: "current-task-id",
			key: "ENG-61",
			title: "Current server title",
		});
		expect(saved.failedStage).toBe("plan");
		expect(saved.lastError).toBe(
			"Planning needs clarification before implementation.",
		);
		expect(saved.planSummary).not.toBe("stale plan");
	});
});

describe("runWorkflow canceled Linear issue intake", () => {
	it("moves an explicitly targeted canceled issue to plan before continuing", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-blocked-explicit-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		const issue = {
			...createWorkflowIssue("ENG-55", 1, "Urgent"),
			state: { id: "state_canceled", name: "Canceled" },
		};
		const markStage = mock(async (_issueId: string, _stage: string) => {});

		await runWorkflow(createLoadedConfig(config), { issueArg: "ENG-55" }, {
			createTaskClient: () =>
				({
					fetchWork: mock(async () => [issue]),
					isAssignedState: mock(async () => false),
					listChatClarificationAnswers: mock(async () => []),
					publishChatClarification: mock(async () => {}),
					markStage,
					comment: mock(async () => {}),
					clearWorkflowStageLabels: mock(async () => {}),
					createTodoIssueFromPlan: mock(async () => ({
						id: "lin_ENG-56",
						identifier: "ENG-56",
						title: "Child task",
						url: "https://linear.example/ENG-56",
					})),
					updateIssueDetails: mock(async () => {}),
				}) as unknown,
			createAgentAdapter: () => createComplexPlanningAgent(),
			ensureBaseBranchFresh: mock(async () => {}),
			sendTaskOutcomeEmail: mock(async () => {}),
		} as unknown as WorkflowRuntime);

		expect(markStage.mock.calls[0]).toEqual(["ENG-55", "plan"]);
		expect(markStage).toHaveBeenCalledWith("ENG-55", "done");
	});

	it("moves a canceled issue with local run state to plan", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-blocked-stale-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		const state = createRunState("ENG-56", "plan", Date.now() - 60000);
		await saveRunState(workspacePath, state);
		const issue = {
			...createWorkflowIssue("ENG-56", 1, "Urgent"),
			id: state.issue.id,
			state: { id: "state_canceled", name: "Canceled" },
		};
		const markStage = mock(async (_issueId: string, _stage: string) => {});

		await runWorkflow(createLoadedConfig(config), { issueArg: "ENG-56" }, {
			createTaskClient: () =>
				({
					fetchWork: mock(async () => [issue]),
					isAssignedState: mock(async () => false),
					markStage,
					comment: mock(async () => {}),
					clearWorkflowStageLabels: mock(async () => {}),
					createTodoIssueFromPlan: mock(async () => ({
						id: "lin_ENG-57",
						identifier: "ENG-57",
						title: "Child task",
						url: "https://linear.example/ENG-57",
					})),
					updateIssueDetails: mock(async () => {}),
				}) as unknown,
			createAgentAdapter: () => createComplexPlanningAgent(),
			ensureBaseBranchFresh: mock(async () => {}),
			sendTaskOutcomeEmail: mock(async () => {}),
		} as unknown as WorkflowRuntime);

		expect(markStage.mock.calls[0]).toEqual([state.issue.id, "plan"]);
	});

	it("keeps skipping non-blocked in-progress issues without local state", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-in-progress-skip-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		const ensureBaseBranchFresh = mock(async () => {});
		const markStage = mock(async (_issueId: string, _stage: string) => {});

		await runWorkflow(createLoadedConfig(config), {}, {
			createTaskClient: () =>
				({
					fetchWork: mock(async () => [
						{
							...createWorkflowIssue("ENG-57", 2, "High"),
							state: { id: "state_in_progress", name: "In Progress" },
						},
					]),
					isAssignedState: mock(async () => false),
					markStage,
				}) as unknown,
			createAgentAdapter: mock(() => ({}) as AgentAdapter),
			ensureBaseBranchFresh,
		} as unknown as WorkflowRuntime);

		expect(ensureBaseBranchFresh).not.toHaveBeenCalled();
		expect(markStage).not.toHaveBeenCalled();
	});

	it("does not move review-only canceled candidates back to plan", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-workflow-blocked-review-only-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		config.executionPath = workspacePath;
		const state = createRunState("ENG-58", "done", Date.now() - 60000);
		state.pullRequest = {
			branch: "codex/eng-58",
			title: "ENG-58",
			url: "https://github.com/acme/repo/pull/58",
		};
		await saveRunState(workspacePath, state);
		const issue = {
			...createWorkflowIssue("ENG-58", 1, "Urgent"),
			id: state.issue.id,
			state: { id: "state_canceled", name: "Canceled" },
		};
		const markStage = mock(async (_issueId: string, _stage: string) => {});

		await runWorkflow(createLoadedConfig(config), { reviewOnly: true }, {
			createTaskClient: () =>
				({
					fetchIssueByIdentifier: mock(async () => issue),
					fetchReviewOnlyWork: mock(async () => []),
					isAssignedState: mock(async () => false),
					markStage,
					clearWorkflowStageLabels: mock(async () => {}),
					comment: mock(async () => {}),
				}) as unknown,
			createAgentAdapter: mock(() => ({}) as AgentAdapter),
			squashMergePullRequest: mock(async () => true),
			sendTaskOutcomeEmail: mock(async () => {}),
		} as unknown as WorkflowRuntime);

		expect(markStage).toHaveBeenCalledWith(state.issue.id, "done");
		expect(markStage).not.toHaveBeenCalledWith(state.issue.id, "plan");
	});
});

describe("stale run retry helpers", () => {
	it("flags retryable stages", () => {
		expect(shouldRetryRunStage("backlog")).toBe(true);
		expect(shouldRetryRunStage("plan")).toBe(true);
		expect(shouldRetryRunStage("in_progress")).toBe(true);
		expect(shouldRetryRunStage("in_review")).toBe(true);
		expect(shouldRetryRunStage("canceled")).toBe(false);
		expect(shouldRetryRunStage("failed")).toBe(false);
		expect(shouldRetryRunStage("done")).toBe(false);
	});

	it("marks only stale active run states for retry", () => {
		const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
		const oldMs = nowMs - 3600000;
		const freshMs = nowMs - 5000;
		const runStates: RunState[] = [
			createRunState("ENG-1", "plan", oldMs),
			createRunState("ENG-2", "in_progress", oldMs),
			createRunState("ENG-3", "in_review", oldMs),
			createRunState("ENG-4", "plan", freshMs),
			createRunState("ENG-5", "done", oldMs),
		];
		const keys = selectStaleRunIssueKeys(runStates, nowMs, 600000);
		expect(keys).toEqual(["ENG-1", "ENG-2", "ENG-3"]);
	});

	it("does not mark state as stale while another active lease is valid", () => {
		const nowMs = Date.parse("2026-05-07T12:00:00.000Z");
		const oldMs = nowMs - 3600000;
		const leaseExpiresAtMs = nowMs + 60000;
		const state = createRunState("ENG-11", "in_progress", oldMs);
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
		const state = createRunState("ENG-12", "in_review", oldMs);
		state.lease = {
			ownerId: "worker-a",
			acquiredAt: new Date(oldMs).toISOString(),
			heartbeatAt: new Date(oldMs).toISOString(),
			expiresAt: new Date(nowMs - 1).toISOString(),
		};

		expect(isRunStateStaleForRetry(state, nowMs, 600000)).toBe(true);
	});

	it("ignores invalid updatedAt values", () => {
		const state = createRunState("ENG-9", "plan", Date.now());
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
				stage: "plan",
				bugs: [],
				startedAt: now,
				updatedAt: now,
			},
			"plan",
		);

		expect(fields).toEqual({
			projectId: "default",
			issueKey: "ENG-1",
			issueId: "lin_123",
			issueTitle: "Improve logging",
			stage: "plan",
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
				stage: "in_progress",
				bugs: [],
				startedAt: now,
				updatedAt: now,
			},
			"in_progress",
			{ resumed: true },
		);

		expect(fields).toEqual({
			projectId: "default",
			issueKey: "ENG-1",
			issueId: "lin_123",
			issueTitle: "Improve logging",
			stage: "in_progress",
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
			stage: "plan",
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
			stage: "plan",
			bugs: [],
			codexUsage: [],
			startedAt: now,
			updatedAt: now,
		};

		appendCodexUsage(state, "planning", undefined);
		expect(state.codexUsage).toHaveLength(0);
	});
});

describe("usage cost estimation", () => {
	it("estimates configured model cost in micro USD", () => {
		const config = createProject("default");
		config.codex.models = { implement: "gpt-5" };
		config.usage = {
			pricing: {
				models: {
					"gpt-5": {
						inputUsdPerMillion: 1.25,
						outputUsdPerMillion: 10,
					},
				},
			},
		};

		const usage = enrichUsageRecord(
			config,
			"implementing",
			{ inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
			"2026-05-26T00:00:00.000Z",
		);

		expect(usage).toMatchObject({
			agentBackend: "codex",
			model: "gpt-5",
			estimatedCostMicrousd: 3250,
		});
	});

	it("uses opencode model for opencode usage records", () => {
		const config = createProject("default");
		config.agent = { backend: "opencode" };
		config.opencode = {
			binary: "opencode",
			streamLogs: false,
			model: "ollama/qwen2.5-coder:32b",
		};
		config.usage = {
			pricing: {
				models: {
					"ollama/qwen2.5-coder:32b": {
						inputUsdPerMillion: 0.5,
						outputUsdPerMillion: 2,
					},
				},
			},
		};

		const usage = enrichUsageRecord(
			config,
			"implementing",
			{ inputTokens: 1000, outputTokens: 200, totalTokens: 1200 },
			"2026-05-26T00:00:00.000Z",
		);

		expect(usage).toMatchObject({
			agentBackend: "opencode",
			model: "ollama/qwen2.5-coder:32b",
			estimatedCostMicrousd: 900,
		});
	});

	it("leaves cost unknown without pricing or token split", () => {
		const config = createProject("default");

		expect(
			estimateUsageCostMicrousd(config, "gpt-5", 1000, 200),
		).toBeUndefined();
		expect(
			estimateUsageCostMicrousd(config, "gpt-5", undefined, 200),
		).toBeUndefined();
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
	it("keeps Linear in review after a passing review result", async () => {
		const workspace = await mkdtemp(
			path.join(os.tmpdir(), "adhd-review-pass-"),
		);
		const state = createRunState("ENG-100", "in_review", Date.now());
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
			runTaskIntake: async () => {
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
			runGithubComment: async () => ({ finalMessage: "", stdout: "" }),
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
		expect(markStage).toHaveBeenCalledWith("lin_ENG-100", "in_review");
		expect(markStage).not.toHaveBeenCalledWith("lin_ENG-100", "done");
		expect(applyStageLabel).toHaveBeenCalledWith("lin_ENG-100", "in_review");
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
				"SUCCESS_GOAL: Preserve the current behavior.",
				"Scope summary",
				"- Keep behavior unchanged.",
				"Implementation steps",
				"- Proceed directly.",
			].join("\n"),
		);
		expect(result).toEqual({
			result: "READY",
			complexity: "SIMPLE",
			splitTasks: [],
			complexityScore: 4,
			successGoal: "Preserve the current behavior.",
		});
	});

	it("parses COMPLEX with valid split task JSON", () => {
		const result = parsePlannerDecision(
			[
				"SUCCESS_GOAL: Ship both split tasks.",
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

		expect(result.result).toBe("READY");
		if (result.result !== "READY") {
			throw new Error("Expected READY planner decision.");
		}
		expect(result.complexity).toBe("COMPLEX");
		expect(result.successGoal).toBe("Ship both split tasks.");
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
					"SUCCESS_GOAL: Split the task.",
					"SPLIT_TASKS_JSON: [",
					'{"title":"Task A"}',
				].join("\n"),
			),
		).toThrow("did not contain a JSON array");
	});

	it("throws when COMPLEX split task array is empty", () => {
		expect(() =>
			parsePlannerDecision(
				[
					"SUCCESS_GOAL: Split the task.",
					"COMPLEXITY: COMPLEX",
					"SPLIT_TASKS_JSON: []",
				].join("\n"),
			),
		).toThrow("must be a non-empty JSON array");
	});

	it("throws when COMPLEXITY_SCORE is invalid", () => {
		expect(() =>
			parsePlannerDecision(
				[
					"SUCCESS_GOAL: Complete the task.",
					"COMPLEXITY: SIMPLE",
					"COMPLEXITY_SCORE: hard",
					"scope",
				].join("\n"),
			),
		).toThrow("Invalid COMPLEXITY_SCORE");
	});

	it("parses NEEDS_INFO with clarification questions", () => {
		const result = parsePlannerDecision(
			[
				"PLANNING_RESULT: NEEDS_INFO",
				"QUESTIONS_JSON:",
				JSON.stringify([
					"Which workflow should change?",
					"What acceptance behavior should review verify?",
				]),
			].join("\n"),
		);

		expect(result).toEqual({
			result: "NEEDS_INFO",
			questions: [
				"Which workflow should change?",
				"What acceptance behavior should review verify?",
			],
		});
	});

	it("throws when NEEDS_INFO questions are missing or empty", () => {
		expect(() => parsePlannerDecision("PLANNING_RESULT: NEEDS_INFO")).toThrow(
			"QUESTIONS_JSON",
		);
		expect(() =>
			parsePlannerDecision(
				["PLANNING_RESULT: NEEDS_INFO", "QUESTIONS_JSON: []"].join("\n"),
			),
		).toThrow("at least one question");
	});

	it("parses SUCCESS_GOAL", () => {
		expect(parsePlannerSuccessGoal("SUCCESS_GOAL: Ship the retry cap.")).toBe(
			"Ship the retry cap.",
		);
	});

	it("throws when SUCCESS_GOAL is missing or empty", () => {
		expect(() => parsePlannerSuccessGoal("COMPLEXITY: SIMPLE")).toThrow(
			"SUCCESS_GOAL",
		);
		expect(() => parsePlannerSuccessGoal("SUCCESS_GOAL:   ")).toThrow(
			"SUCCESS_GOAL",
		);
	});

	it("parses fenced QUESTIONS_JSON", () => {
		expect(
			parsePlannerQuestions(
				[
					"PLANNING_RESULT: NEEDS_INFO",
					"QUESTIONS_JSON:",
					"```json",
					JSON.stringify(["What should happen?"]),
					"```",
				].join("\n"),
			),
		).toEqual(["What should happen?"]);
	});
});

describe("handlePlanningStage", () => {
	it("resumes the parent task session when child issue planning has a parent run", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-parent-session-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;
		const parentState = createRunState("ROY-80", "done", Date.now());
		parentState.codexSessionId = "parent-session";
		await saveRunState(workspacePath, parentState);

		const state = createRunState("ROY-81", "plan", Date.now());
		state.issue.parentIssue = {
			id: parentState.issue.id,
			key: parentState.issue.key,
			title: parentState.issue.title,
			url: parentState.issue.url,
		};
		const planSummary = [
			"SUCCESS_GOAL: Ship the child task.",
			"COMPLEXITY: SIMPLE",
			"ISSUE_REFINEMENT_JSON:",
			JSON.stringify({
				title: "Planner should not rename this",
				description: "Planner should not rewrite this.",
			}),
		].join("\n");
		const agent: AgentAdapter = {
			runPlan: mock(async () => ({ finalMessage: "", stdout: "" })),
			runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
			resume: mock(async () => ({
				finalMessage: planSummary,
				stdout: "",
				sessionId: "child-session",
			})),
			runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
			runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
		};
		const markStage = mock(async () => {});
		const updateIssueDetails = mock(async () => {});
		const originalTitle = state.issue.title;
		const originalDescription = state.issue.description;

		await handlePlanningStage(
			config,
			agent,
			{ email: { enabled: false, to: [] } },
			{
				createTodoIssueFromPlan: mock(async () => ({
					id: "lin_child",
					identifier: "ROY-82",
					title: "unused",
					url: "https://linear.example/ROY-82",
				})),
				markStage,
				clearWorkflowStageLabels: mock(async () => {}),
				comment: mock(async () => {}),
				updateIssueDetails,
			} as never,
			state,
			{
				runAgentWithChatLog: async ({ invoke }) => invoke(),
				appendCodexUsage: () => {},
				saveRunState: mock(async () => {}),
				transitionStage,
				safeNotifyTaskOutcome: mock(async () => {}),
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		expect(agent.resume).toHaveBeenCalledWith(
			"parent-session",
			expect.stringContaining("Parent issue: ROY-80 - ROY-80"),
		);
		expect(agent.runPlan).not.toHaveBeenCalled();
		expect(state.codexSessionId).toBe("child-session");
		expect(markStage).toHaveBeenCalledWith(state.issue.id, "in_progress");
		expect(updateIssueDetails).not.toHaveBeenCalled();
		expect(state.issue.title).toBe(originalTitle);
		expect(state.issue.description).toBe(originalDescription);
	});

	it("starts a new planning session when no parent session exists", async () => {
		const workspacePath = await mkdtemp(
			path.join(os.tmpdir(), "adhd-parent-session-missing-"),
		);
		const config = createProject("default");
		config.workspacePath = workspacePath;

		const state = createRunState("ROY-91", "plan", Date.now());
		state.issue.parentIssue = {
			id: "lin_ROY-90",
			key: "ROY-90",
			title: "Parent without local state",
			url: "https://linear.example/ROY-90",
		};
		const planSummary = [
			"SUCCESS_GOAL: Ship the child task.",
			"COMPLEXITY: SIMPLE",
		].join("\n");
		const agent: AgentAdapter = {
			runPlan: mock(async () => ({
				finalMessage: planSummary,
				stdout: "",
				sessionId: "new-child-session",
			})),
			runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
			resume: mock(async () => ({ finalMessage: "", stdout: "" })),
			runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
			runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
		};

		await handlePlanningStage(
			config,
			agent,
			{ email: { enabled: false, to: [] } },
			{
				createTodoIssueFromPlan: mock(async () => ({
					id: "lin_child",
					identifier: "ROY-92",
					title: "unused",
					url: "https://linear.example/ROY-92",
				})),
				markStage: mock(async () => {}),
				clearWorkflowStageLabels: mock(async () => {}),
				comment: mock(async () => {}),
				updateIssueDetails: mock(async () => {}),
			} as never,
			state,
			{
				runAgentWithChatLog: async ({ invoke }) => invoke(),
				appendCodexUsage: () => {},
				saveRunState: mock(async () => {}),
				transitionStage,
				safeNotifyTaskOutcome: mock(async () => {}),
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		expect(agent.runPlan).toHaveBeenCalled();
		expect(agent.resume).not.toHaveBeenCalled();
		expect(state.codexSessionId).toBe("new-child-session");
	});

	it("parks unclear planner output as canceled with clarification questions", async () => {
		const config = createProject("default");
		const state = createRunState("ROY-95", "plan", Date.now());
		const planSummary = [
			"PLANNING_RESULT: NEEDS_INFO",
			"QUESTIONS_JSON:",
			JSON.stringify(["What acceptance behavior should review verify?"]),
		].join("\n");
		const agent: AgentAdapter = {
			runPlan: mock(async () => ({
				finalMessage: planSummary,
				stdout: "",
				sessionId: "needs-info-session",
			})),
			runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
			resume: mock(async () => ({ finalMessage: "", stdout: "" })),
			runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
			runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
		};
		const markStage = mock(async () => {});
		const clearWorkflowStageLabels = mock(async () => {});
		const comment = mock(async () => {});
		const saveRunState = mock(async () => {});
		const safeNotifyTaskOutcome = mock(async () => {});

		await handlePlanningStage(
			config,
			agent,
			{ email: { enabled: false, to: [] } },
			{
				createTodoIssueFromPlan: mock(async () => ({
					id: "lin_child",
					identifier: "ROY-96",
					title: "unused",
					url: "https://linear.example/ROY-96",
				})),
				markStage,
				clearWorkflowStageLabels,
				comment,
				updateIssueDetails: mock(async () => {}),
			} as never,
			state,
			{
				runAgentWithChatLog: async ({ invoke }) => invoke(),
				appendCodexUsage: () => {},
				saveRunState,
				transitionStage,
				safeNotifyTaskOutcome,
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		expect(state.stage).toBe("canceled");
		expect(state.failedStage).toBe("plan");
		expect(state.successGoal).toBeUndefined();
		expect(state.planningNeedsInfoQuestions).toEqual([
			"What acceptance behavior should review verify?",
		]);
		expect(saveRunState).toHaveBeenCalledWith(config.workspacePath, state);
		expect(markStage).toHaveBeenCalledWith(state.issue.id, "canceled");
		expect(clearWorkflowStageLabels).toHaveBeenCalledWith(state.issue.id);
		const commentCalls = comment.mock.calls as unknown as [string, string][];
		expect(commentCalls[0]?.[1]).toContain(
			"Planning could not define a concise acceptance goal",
		);
		expect(safeNotifyTaskOutcome).toHaveBeenCalledWith(
			{ email: { enabled: false, to: [] } },
			state,
			"canceled",
			"Planning needs clarification before implementation.",
		);
	});

	it("retries malformed planner output once before parking as canceled", async () => {
		const config = createProject("default");
		const state = createRunState("ROY-97", "plan", Date.now());
		const agent: AgentAdapter = {
			runPlan: mock(async () => ({
				finalMessage: "I cannot tell what this means.",
				stdout: "",
				sessionId: "malformed-session",
			})),
			runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
			resume: mock(async () => ({
				finalMessage: "Still no routing contract.",
				stdout: "",
				sessionId: "repair-session",
			})),
			runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
			runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
		};
		const markStage = mock(async () => {});
		const clearWorkflowStageLabels = mock(async () => {});
		const comment = mock(async () => {});

		await handlePlanningStage(
			config,
			agent,
			{ email: { enabled: false, to: [] } },
			{
				createTodoIssueFromPlan: mock(async () => ({
					id: "lin_child",
					identifier: "ROY-98",
					title: "unused",
					url: "https://linear.example/ROY-98",
				})),
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
				safeNotifyTaskOutcome: mock(async () => {}),
				loggerInfo: () => {},
				buildIssueJobLogFields: () => ({}),
			},
		);

		expect(agent.resume).toHaveBeenCalledWith(
			"malformed-session",
			expect.stringContaining("previous planning response"),
		);
		expect(state.stage).toBe("canceled");
		expect(state.planningNeedsInfoQuestions).toEqual([
			"What outcome should this task accomplish, and how should review/testing verify it?",
		]);
		expect(markStage).toHaveBeenCalledWith(state.issue.id, "canceled");
		expect(clearWorkflowStageLabels).toHaveBeenCalledWith(state.issue.id);
		const commentCalls = comment.mock.calls as unknown as [string, string][];
		expect(commentCalls[0]?.[1]).toContain("Questions:");
	});

	it("moves the parent issue to done after creating split sub-issues", async () => {
		const config = createProject("default");
		const state = createRunState("ROY-80", "plan", Date.now());
		const planSummary = [
			"SUCCESS_GOAL: Extract the API layer into a follow-up task.",
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
			runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
			resume: mock(async () => ({ finalMessage: "", stdout: "" })),
			runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
			runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
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
		expect(markStage).toHaveBeenCalledWith(state.issue.id, "done");
		expect(clearWorkflowStageLabels).toHaveBeenCalledWith(state.issue.id);
		const commentCalls = comment.mock.calls as unknown as [string, string][];
		expect(commentCalls[0]?.[1]).toContain("moved the parent issue to Done");
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

describe("planner routing with missing score", () => {
	it("routes simple plans without score to bot review mode", () => {
		const decision = parsePlannerDecision(
			[
				"SUCCESS_GOAL: Complete the simple task.",
				"COMPLEXITY: SIMPLE",
				"scope summary",
				"implementation steps",
			].join("\n"),
		);
		expect(decision.result).toBe("READY");
		if (decision.result !== "READY") {
			throw new Error("Expected READY planner decision.");
		}
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
			"in_progress",
		);
	});

	it("routes to in_review when codex session is missing", () => {
		expect(resolveReviewFailureStage({ codexSessionId: undefined })).toBe(
			"in_review",
		);
	});
});

describe("shouldSkipReviewOnlyRunState", () => {
	it("skips canceled states in review-only mode", () => {
		expect(
			shouldSkipReviewOnlyRunState({ stage: "canceled" }, { reviewOnly: true }),
		).toBe(true);
	});

	it("does not skip non-human-review states in review-only mode", () => {
		expect(
			shouldSkipReviewOnlyRunState(
				{ stage: "in_review" },
				{ reviewOnly: true },
			),
		).toBe(false);
	});

	it("does not skip when review-only mode is disabled", () => {
		expect(
			shouldSkipReviewOnlyRunState(
				{ stage: "canceled" },
				{ reviewOnly: false },
			),
		).toBe(false);
	});
});

describe("isolated worktree workflow helpers", () => {
	it("enables isolation from CLI option or project config", () => {
		const config = createProject("default");
		expect(shouldUseIsolatedWorktree(config, {}, 1)).toBe(false);
		expect(
			shouldUseIsolatedWorktree(config, { isolatedWorktrees: true }, 1),
		).toBe(true);
		config.workflow.isolatedWorktrees = { enabled: true };
		expect(shouldUseIsolatedWorktree(config, {}, 1)).toBe(true);
	});

	it("automatically enables isolation for parallel issue execution", () => {
		const config = createProject("default");

		expect(shouldUseIsolatedWorktree(config, {}, 2)).toBe(true);
	});

	it("resolves deterministic project worktree paths", () => {
		const config = createProject("default");
		config.workflow.isolatedWorktrees = { enabled: true };
		const state = createRunState("ENG-42", "in_progress", Date.now());
		expect(isolatedWorktreePath(config, state)).toBe(
			"/tmp/workspace/.devos/projects/default/worktrees/eng-42",
		);

		config.workflow.isolatedWorktrees.root = "/tmp/adhd-worktrees";
		expect(isolatedWorktreePath(config, state)).toBe(
			"/tmp/adhd-worktrees/default/eng-42",
		);
	});

	it("prepares an issue-scoped execution config while preserving shared state path", async () => {
		const config = createProject("default");
		config.workflow.isolatedWorktrees = { enabled: true };
		const state = createRunState("ENG-42", "in_progress", Date.now());
		const calls: string[] = [];
		const ensureBaseBranchFresh = mock(async () => {
			calls.push("ensureBaseBranchFresh");
		});
		const ensureIssueWorktree = mock(async () => {
			calls.push("ensureIssueWorktree");
			return "codex/eng-42";
		});
		const prepareWorktreeDependencies = mock(async (worktreePath: string) => {
			calls.push(`prepareWorktreeDependencies:${worktreePath}`);
		});
		const runtime = {
			ensureBaseBranchFresh,
			ensureIssueWorktree,
			prepareWorktreeDependencies,
		} as unknown as WorkflowRuntime;

		const isolatedConfig = await prepareIsolatedExecutionConfig(
			config,
			state,
			runtime,
		);

		expect(isolatedConfig.workspacePath).toBe(config.workspacePath);
		expect(isolatedConfig.executionPath).toBe(
			"/tmp/workspace/.devos/projects/default/worktrees/eng-42",
		);
		expect(state.executionWorkspace).toMatchObject({
			mode: "git-worktree",
			path: isolatedConfig.executionPath,
			branch: "codex/eng-42",
		});
		expect(ensureBaseBranchFresh).toHaveBeenCalledWith(config);
		expect(ensureIssueWorktree).toHaveBeenCalledWith(
			config,
			"ENG-42",
			undefined,
			isolatedConfig.executionPath,
			undefined,
		);
		expect(prepareWorktreeDependencies).toHaveBeenCalledWith(
			isolatedConfig.executionPath,
		);
		expect(calls).toEqual([
			"ensureBaseBranchFresh",
			"ensureIssueWorktree",
			"prepareWorktreeDependencies:/tmp/workspace/.devos/projects/default/worktrees/eng-42",
		]);
	});

	it("passes board task branch names into isolated worktree preparation", async () => {
		const config = createProject("default");
		config.workflow.isolatedWorktrees = { enabled: true };
		const state = createRunState("TASK(OWNER-1)-1", "in_progress", Date.now());
		state.issue.branchName = "OWN-1";
		const ensureIssueWorktree = mock(async () => "OWN-1");
		const runtime = {
			ensureBaseBranchFresh: mock(async () => {}),
			ensureIssueWorktree,
			prepareWorktreeDependencies: mock(async () => {}),
		} as unknown as WorkflowRuntime;

		const isolatedConfig = await prepareIsolatedExecutionConfig(
			config,
			state,
			runtime,
		);

		expect(state.executionWorkspace).toMatchObject({
			mode: "git-worktree",
			path: isolatedConfig.executionPath,
			branch: "OWN-1",
		});
		expect(ensureIssueWorktree).toHaveBeenCalledWith(
			config,
			"TASK(OWNER-1)-1",
			undefined,
			isolatedConfig.executionPath,
			"OWN-1",
		);
	});

	it("builds absolute isolated worktree paths from relative workspace config", async () => {
		const config = createProject("default");
		config.workspacePath = ".";
		config.executionPath = ".";
		config.workflow.isolatedWorktrees = { enabled: true };
		const state = createRunState("ENG-42", "in_progress", Date.now());
		const runtime = {
			ensureBaseBranchFresh: mock(async () => {}),
			ensureIssueWorktree: mock(
				async (
					_projectConfig: ResolvedProjectConfig,
					_issueKey: string,
					_pullRequest: RunState["pullRequest"],
					worktreePath: string,
				) => {
					expect(path.isAbsolute(worktreePath)).toBe(true);
					return "codex/eng-42";
				},
			),
			prepareWorktreeDependencies: mock(async () => {}),
		} as unknown as WorkflowRuntime;

		const isolatedConfig = await prepareIsolatedExecutionWorkspace(
			config,
			state,
			runtime,
		);

		expect(isolatedConfig.executionPath).toBe(
			path.resolve(".devos/projects/default/worktrees/eng-42"),
		);
		expect(state.executionWorkspace?.path).toBe(isolatedConfig.executionPath);
		expect(isolatedWorktreePath(config, state)).toBe(
			isolatedConfig.executionPath,
		);
	});

	it("prepares isolated workspace metadata without installing dependencies", async () => {
		const config = createProject("default");
		config.workflow.isolatedWorktrees = { enabled: true };
		const state = createRunState("ENG-42", "in_progress", Date.now());
		const ensureBaseBranchFresh = mock(async () => {});
		const ensureIssueWorktree = mock(async () => "codex/eng-42");
		const prepareWorktreeDependencies = mock(async () => {});
		const runtime = {
			ensureBaseBranchFresh,
			ensureIssueWorktree,
			prepareWorktreeDependencies,
		} as unknown as WorkflowRuntime;

		const isolatedConfig = await prepareIsolatedExecutionWorkspace(
			config,
			state,
			runtime,
		);

		expect(isolatedConfig.executionPath).toBe(
			"/tmp/workspace/.devos/projects/default/worktrees/eng-42",
		);
		expect(prepareWorktreeDependencies).not.toHaveBeenCalled();
		expect(state.executionWorkspace).toMatchObject({
			mode: "git-worktree",
			path: isolatedConfig.executionPath,
			branch: "codex/eng-42",
		});
	});

	it("records isolated execution state before dependency setup and rethrows failures", async () => {
		const config = createProject("default");
		config.workflow.isolatedWorktrees = { enabled: true };
		const state = createRunState("ENG-42", "in_progress", Date.now());
		const prepareWorktreeDependencies = mock(async () => {
			throw new Error("bun install --frozen-lockfile failed");
		});
		const runtime = {
			ensureBaseBranchFresh: mock(async () => {}),
			ensureIssueWorktree: mock(async () => "codex/eng-42"),
			prepareWorktreeDependencies,
		} as unknown as WorkflowRuntime;

		await expect(
			prepareIsolatedExecutionConfig(config, state, runtime),
		).rejects.toThrow("bun install --frozen-lockfile failed");
		expect(prepareWorktreeDependencies).toHaveBeenCalledWith(
			"/tmp/workspace/.devos/projects/default/worktrees/eng-42",
		);
		expect(state.executionWorkspace).toMatchObject({
			mode: "git-worktree",
			path: "/tmp/workspace/.devos/projects/default/worktrees/eng-42",
			branch: "codex/eng-42",
		});
	});

	it("cleans terminal worktrees and keeps dirty retained worktrees in state", async () => {
		const config = createProject("default");
		const state = createRunState("ENG-42", "done", Date.now());
		state.executionWorkspace = {
			mode: "git-worktree",
			path: "/tmp/worktrees/eng-42",
			branch: "codex/eng-42",
			createdAt: new Date().toISOString(),
		};
		const runtime = {
			removeIssueWorktree: mock(async () => ({ removed: true })),
		} as unknown as WorkflowRuntime;

		await expect(
			cleanupTerminalIsolatedWorktree(config, state, runtime),
		).resolves.toBe(true);
		expect(state.executionWorkspace).toBeUndefined();

		state.stage = "failed";
		state.executionWorkspace = {
			mode: "git-worktree",
			path: "/tmp/worktrees/eng-42",
			branch: "codex/eng-42",
			createdAt: new Date().toISOString(),
		};
		const dirtyRuntime = {
			removeIssueWorktree: mock(async () => ({
				removed: false,
				reason: "contains modified files",
			})),
		} as unknown as WorkflowRuntime;

		await expect(
			cleanupTerminalIsolatedWorktree(config, state, dirtyRuntime),
		).resolves.toBe(false);
		expect(state.executionWorkspace?.path).toBe("/tmp/worktrees/eng-42");
	});

	it("keeps in-review worktrees for follow-up", async () => {
		const config = createProject("default");
		const state = createRunState("ENG-42", "in_review", Date.now());
		state.executionWorkspace = {
			mode: "git-worktree",
			path: "/tmp/worktrees/eng-42",
			branch: "codex/eng-42",
			createdAt: new Date().toISOString(),
		};
		const removeIssueWorktree = mock(async () => ({ removed: true }));
		const runtime = { removeIssueWorktree } as unknown as WorkflowRuntime;

		await expect(
			cleanupTerminalIsolatedWorktree(config, state, runtime),
		).resolves.toBe(false);
		expect(removeIssueWorktree).not.toHaveBeenCalled();
	});
});

describe("prepareImplementationBranchForStage", () => {
	it("passes board task branch names into normal branch preparation", async () => {
		const config = createProject("default");
		const state = createRunState("TASK(OWNER-1)-1", "in_progress", Date.now());
		state.issue.branchName = "OWN-1";
		const prepareImplementationBranch = mock(async () => "OWN-1");
		const runtime = {
			prepareImplementationBranch,
		} as unknown as WorkflowRuntime;

		await prepareImplementationBranchForStage(config, state, runtime);

		expect(prepareImplementationBranch).toHaveBeenCalledWith(
			config,
			"TASK(OWNER-1)-1",
			undefined,
			"OWN-1",
		);
		expect(state.pullRequest).toMatchObject({
			branch: "OWN-1",
			title: "[codex] TASK(OWNER-1)-1: TASK(OWNER-1)-1",
		});
	});

	it("does not prepare a branch again inside an isolated worktree", async () => {
		const config = createProject("default");
		const state = createRunState("ENG-42", "in_progress", Date.now());
		state.executionWorkspace = {
			mode: "git-worktree",
			path: "/tmp/worktrees/eng-42",
			branch: "codex/eng-42",
			createdAt: new Date().toISOString(),
		};
		const prepareImplementationBranch = mock(async () => "codex/eng-42");
		const runtime = {
			prepareImplementationBranch,
		} as unknown as WorkflowRuntime;

		await prepareImplementationBranchForStage(config, state, runtime);

		expect(prepareImplementationBranch).not.toHaveBeenCalled();
		expect(state.pullRequest).toMatchObject({
			branch: "codex/eng-42",
			title: "[codex] ENG-42: ENG-42",
		});
	});

	it("rejects an isolated worktree on a different PR branch", async () => {
		const config = createProject("default");
		const state = createRunState("ENG-42", "in_progress", Date.now());
		state.pullRequest = {
			branch: "codex/eng-42-fix",
			title: "ENG-42",
			url: "https://github.com/acme/repo/pull/42",
		};
		state.executionWorkspace = {
			mode: "git-worktree",
			path: "/tmp/worktrees/eng-42",
			branch: "codex/eng-42",
			createdAt: new Date().toISOString(),
		};
		const runtime = {
			prepareImplementationBranch: mock(async () => "codex/eng-42-fix"),
		} as unknown as WorkflowRuntime;

		await expect(
			prepareImplementationBranchForStage(config, state, runtime),
		).rejects.toThrow("does not match expected branch");
	});
});

function createLoadedConfig(config: ResolvedProjectConfig): LoadedConfig {
	return createLoadedConfigWithProjects([config]);
}

function createLoadedConfigWithProjects(
	projects: ResolvedProjectConfig[],
): LoadedConfig {
	const baseConfig = projects[0] ?? createProject("default");
	return {
		projects,
		server: baseConfig.server,
		polling: {
			intervalMs: 1,
			maxCycles: 1,
			exitWhenIdle: true,
			staleRunTimeoutMs: 1,
		},
		notifications: {
			email: {
				enabled: false,
				resendApiKey: undefined,
				from: undefined,
				to: [],
			},
		},
		workspace: { id: "owner-1", name: "Default Workspace" },
	};
}

function createComplexPlanningAgent(): AgentAdapter {
	const planResult = async () => ({
		finalMessage: [
			"PLANNING_RESULT: READY",
			"SUCCESS_GOAL: Split the blocked issue into a child task.",
			"COMPLEXITY: COMPLEX",
			"COMPLEXITY_SCORE: 4",
			"SPLIT_TASKS_JSON:",
			JSON.stringify([
				{
					title: "Child task",
					description: "Implement the child task.",
				},
			]),
		].join("\n"),
		stdout: "",
		sessionId: "plan-session",
	});
	return {
		runAgent: mock(async (request: { role: string }) =>
			request.role === "brainstorm" ? brainstormReadyResult() : planResult(),
		),
		runPlan: mock(planResult),
		runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
		resume: mock(async () => ({ finalMessage: "", stdout: "" })),
		runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
		runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
	};
}

function createProject(id: string): ResolvedProjectConfig {
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
		github: {
			useGhCli: true,
			defaultBugLabel: "bug",
		},
		server: {
			database: {
				databasePath: "/tmp/workspace/.devos/config/server-db",
				port: 54329,
			},
		},
		codex: {
			binary: "codex",
			streamLogs: false,
		},
		skills: {
			root: "/tmp/skills",
			brainstorm: "/tmp/brainstorm.md",
			plan: "/tmp/plan.md",
			implement: "/tmp/implement.md",
			reviewTest: "/tmp/review.md",
			githubComment: "/tmp/github-comment.md",
		},
		workflow: {
			issueConcurrency: 1,
		},
		dryRun: false,
	};
}

function createRunState(
	issueKey: string,
	stage: RunState["stage"] | string,
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
		stage: stage as RunState["stage"],
		bugs: [],
		startedAt: updatedAt,
		updatedAt,
	};
}

function createNeedsInfoPlanningAgent(): AgentAdapter {
	const planResult = async () => ({
		finalMessage: [
			"PLANNING_RESULT: NEEDS_INFO",
			"QUESTIONS_JSON:",
			JSON.stringify(["Which task behavior should change?"]),
		].join("\n"),
		stdout: "",
		sessionId: "needs-info-session",
	});
	return {
		runAgent: mock(async (request: { role: string }) =>
			request.role === "brainstorm" ? brainstormReadyResult() : planResult(),
		),
		runPlan: mock(planResult),
		runTaskIntake: mock(async () => ({ finalMessage: "", stdout: "" })),
		resume: mock(async () => ({ finalMessage: "", stdout: "" })),
		runReview: mock(async () => ({ finalMessage: "", stdout: "" })),
		runGithubComment: mock(async () => ({ finalMessage: "", stdout: "" })),
	};
}

function brainstormReadyResult() {
	return {
		finalMessage: "BRAINSTORM_RESULT: READY\nSUMMARY: Ready to plan.",
		stdout: "",
		sessionId: "brainstorm-session",
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

async function captureStderr(run: () => Promise<void>): Promise<string> {
	const originalWrite = process.stderr.write;
	const originalLogLevel = process.env.PIV_LOG_LEVEL;
	let output = "";
	process.env.PIV_LOG_LEVEL = "info";
	process.stderr.write = ((chunk: string | Uint8Array) => {
		output += chunk.toString();
		return true;
	}) as typeof process.stderr.write;
	try {
		await run();
		return stripVTControlCharacters(output);
	} finally {
		process.stderr.write = originalWrite;
		if (originalLogLevel === undefined) {
			Reflect.deleteProperty(process.env, "PIV_LOG_LEVEL");
		} else {
			process.env.PIV_LOG_LEVEL = originalLogLevel;
		}
	}
}

function installWorkflowPollingSocket(): {
	calls: Array<Record<string, unknown>>;
	restore(): void;
} {
	const previousWebSocket = globalThis.WebSocket;
	const calls: Array<Record<string, unknown>> = [];
	globalThis.WebSocket = class FakeWorkflowSocket extends EventTarget {
		constructor(_url: string) {
			super();
			queueMicrotask(() => this.dispatchEvent(new Event("open")));
		}

		send(message: string): void {
			const body = JSON.parse(message) as {
				requestId: string;
				action: string;
				payload: Record<string, unknown>;
			};
			if (body.action === "polling.record") {
				calls.push(body.payload);
			}
			queueMicrotask(() => {
				this.dispatchEvent(
					new MessageEvent("message", {
						data: JSON.stringify({
							type: "workflow.response",
							requestId: body.requestId,
							action: body.action,
							status: "ok",
							payload: { recorded: true },
						}),
					}),
				);
			});
		}

		close(): void {}
	} as unknown as typeof WebSocket;
	return {
		calls,
		restore() {
			globalThis.WebSocket = previousWebSocket;
		},
	};
}

function installFailingWorkflowPollingSocket(): { restore(): void } {
	const previousWebSocket = globalThis.WebSocket;
	globalThis.WebSocket = class FailingWorkflowSocket extends EventTarget {
		constructor(_url: string) {
			super();
			queueMicrotask(() => this.dispatchEvent(new Event("error")));
		}

		send(_message: string): void {}

		close(): void {}
	} as unknown as typeof WebSocket;
	return {
		restore() {
			globalThis.WebSocket = previousWebSocket;
		},
	};
}

describe("routeProjectsForIssueProjectId", () => {
	it("routes to explicit project id match", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api"), createProject("web")],
			"web",
		);
		expect(result).toEqual({
			selectedProjectId: "web",
		});
	});

	it("skips when no configured project matches issue project id", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api"), createProject("web")],
			"unknown",
		);
		expect(result.selectedProjectId).toBeUndefined();
		expect(result.error).toBeUndefined();
		expect(result.skipReason).toContain("No project configured");
	});

	it("routes missing issue project id to the only configured project", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api")],
			undefined,
		);
		expect(result).toEqual({
			selectedProjectId: "api",
		});
	});

	it("skips when issue has no project id and multiple projects exist", () => {
		const result = routeProjectsForIssueProjectId(
			[createProject("api"), createProject("web")],
			undefined,
		);
		expect(result.skipReason).toContain("no project id");
	});
});
