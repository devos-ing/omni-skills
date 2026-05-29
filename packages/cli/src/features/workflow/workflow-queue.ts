import type {
	PullRequestRef,
	RunOptions,
	RunState,
	WorkflowStage,
} from "../types";
import { normalizeIssueKey } from "./state";
import type {
	ReviewOnlyQueueBuildResult,
	ReviewOnlyQueueInput,
	WorkflowIssue,
} from "./types/workflow.types";

export interface WorkflowQueueIssue {
	identifier: string;
	priority: {
		value: number;
		name: string;
	};
}

const PRIORITY_SORT_ORDER: Record<number, number> = {
	1: 0,
	2: 1,
	3: 2,
	4: 3,
	0: 4,
};

function getPriorityRank(priority: number): number {
	return PRIORITY_SORT_ORDER[priority] ?? PRIORITY_SORT_ORDER[0];
}

export function dedupeIssuesByKey<T extends WorkflowQueueIssue>(
	issues: T[],
): T[] {
	const seen = new Set<string>();
	const unique: T[] = [];
	for (const issue of issues) {
		const key = normalizeIssueKey(issue.identifier);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		unique.push(issue);
	}
	return unique;
}

export function buildPrioritizedIssueQueue<T extends WorkflowQueueIssue>(
	assignedIssues: T[],
	staleRetryIssues: T[],
): T[] {
	return dedupeIssuesByKey([...assignedIssues, ...staleRetryIssues])
		.map((issue, index) => ({ issue, index }))
		.sort((left, right) => {
			const rankDiff =
				getPriorityRank(left.issue.priority.value) -
				getPriorityRank(right.issue.priority.value);
			if (rankDiff !== 0) {
				return rankDiff;
			}
			return left.index - right.index;
		})
		.map((entry) => entry.issue);
}

export function selectIssueQueueForCycle<T extends WorkflowQueueIssue>(
	issueArg: string | undefined,
	assignedIssues: T[],
	staleRetryIssues: T[],
	options: Pick<RunOptions, "reviewOnly"> = {},
): T[] {
	if (options.reviewOnly) {
		return [];
	}
	if (issueArg !== undefined) {
		return assignedIssues;
	}
	return buildPrioritizedIssueQueue(assignedIssues, staleRetryIssues);
}

export function isReviewOnlyEligibleRunState(state: RunState): boolean {
	return (
		(state.stage === "in_review" ||
			(state.stage === "done" &&
				!state.pullRequestApprovedAt &&
				!state.humanReviewNotifiedAt)) &&
		Boolean(state.pullRequest?.url)
	);
}

export function selectReviewOnlyIssueKeys(runStates: RunState[]): string[] {
	return runStates
		.filter((state) => isReviewOnlyEligibleRunState(state))
		.map((state) => normalizeIssueKey(state.issue.key));
}

export function isReviewOnlyExecutableStage(stage: WorkflowStage): boolean {
	return stage === "in_review" || stage === "done";
}

export function shouldSkipReviewOnlyRunState(
	state: Pick<RunState, "stage"> | null,
	options: Pick<RunOptions, "reviewOnly">,
): boolean {
	return options.reviewOnly === true && state?.stage === "canceled";
}

export function shouldRetryRunStage(stage: WorkflowStage): boolean {
	return (
		stage === "backlog" ||
		stage === "plan" ||
		stage === "in_progress" ||
		stage === "in_review"
	);
}

export function isRunStateStaleForRetry(
	state: RunState,
	nowMs: number,
	timeoutMs: number,
	isLeaseExpired: (state: RunState, nowMs?: number) => boolean,
): boolean {
	if (!shouldRetryRunStage(state.stage)) {
		return false;
	}
	if (!isLeaseExpired(state, nowMs)) {
		return false;
	}
	const updatedAtMs = Date.parse(state.updatedAt);
	if (Number.isNaN(updatedAtMs)) {
		return false;
	}
	return nowMs - updatedAtMs >= timeoutMs;
}

export function selectStaleRunIssueKeys(
	runStates: RunState[],
	nowMs: number,
	timeoutMs: number,
	isLeaseExpired: (state: RunState, nowMs?: number) => boolean,
): string[] {
	return runStates
		.filter((state) =>
			isRunStateStaleForRetry(state, nowMs, timeoutMs, isLeaseExpired),
		)
		.map((state) => normalizeIssueKey(state.issue.key));
}

export function buildReviewOnlyIssueQueue(
	input: ReviewOnlyQueueInput,
): ReviewOnlyQueueBuildResult {
	const merged = dedupeIssuesByKey([...input.localIssues, ...input.taskIssues]);
	const runStateByKey = new Map(
		input.runStates.map((state) => [normalizeIssueKey(state.issue.key), state]),
	);
	const issueQueue: WorkflowIssue[] = [];
	let discoveredPrCount = 0;
	let skippedWithoutPr = 0;

	for (const issue of merged) {
		const key = normalizeIssueKey(issue.identifier);
		const runState = runStateByKey.get(key);
		if (runState?.stage === "done" && !isReviewOnlyEligibleRunState(runState)) {
			continue;
		}
		const runStatePr = runState?.pullRequest;
		const discoveredPr = input.discoveredPullRequestsByIssueKey.get(key);
		const pullRequest: PullRequestRef | undefined = runStatePr?.url
			? runStatePr
			: discoveredPr;

		if (!runStatePr?.url && discoveredPr?.url) {
			discoveredPrCount += 1;
		}
		if (!pullRequest?.url) {
			skippedWithoutPr += 1;
			continue;
		}

		issueQueue.push({
			...issue,
			pullRequest,
		});
	}

	return {
		issueQueue: buildPrioritizedIssueQueue(issueQueue, []),
		mergedCandidateCount: merged.length,
		discoveredPrCount,
		skippedWithoutPr,
	};
}

export function normalizeIssueConcurrency(
	concurrency: number | undefined,
): number {
	if (!Number.isInteger(concurrency) || (concurrency ?? 0) <= 0) {
		return 1;
	}
	return Number(concurrency);
}

export async function processIssueQueueBounded<T>(
	issues: T[],
	concurrency: number | undefined,
	worker: (issue: T) => Promise<void>,
): Promise<void> {
	const effectiveConcurrency = normalizeIssueConcurrency(concurrency);
	let nextIndex = 0;

	async function runWorker(): Promise<void> {
		while (true) {
			const index = nextIndex;
			nextIndex += 1;
			if (index >= issues.length) {
				return;
			}
			await worker(issues[index] as T);
		}
	}

	await Promise.all(
		Array.from({ length: Math.min(effectiveConcurrency, issues.length) }, () =>
			runWorker(),
		),
	);
}
