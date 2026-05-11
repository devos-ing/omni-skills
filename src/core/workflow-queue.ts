import { normalizeIssueKey } from "./state";
import type {
	PullRequestRef,
	RunOptions,
	RunState,
	WorkflowStage,
} from "./types";
import type {
	ReviewOnlyQueueBuildResult,
	ReviewOnlyQueueInput,
	WorkflowIssue,
} from "./workflow.types";

export interface WorkflowQueueIssue {
	identifier: string;
	priority: {
		value: number;
		name: string;
	};
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
	return dedupeIssuesByKey([...assignedIssues, ...staleRetryIssues]);
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
		(state.stage === "pr_created" ||
			state.stage === "reviewing" ||
			state.stage === "testing" ||
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
	return (
		stage === "pr_created" ||
		stage === "reviewing" ||
		stage === "testing" ||
		stage === "done"
	);
}

export function shouldSkipReviewOnlyRunState(
	state: Pick<RunState, "stage"> | null,
	options: Pick<RunOptions, "reviewOnly">,
): boolean {
	return options.reviewOnly === true && state?.stage === "human_review";
}

export function shouldRetryRunStage(stage: WorkflowStage): boolean {
	return (
		stage === "received" ||
		stage === "planning" ||
		stage === "implementing" ||
		stage === "pr_created" ||
		stage === "reviewing" ||
		stage === "testing"
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
	const merged = dedupeIssuesByKey([
		...input.localIssues,
		...input.linearIssues,
	]);
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
		issueQueue,
		mergedCandidateCount: merged.length,
		discoveredPrCount,
		skippedWithoutPr,
	};
}
