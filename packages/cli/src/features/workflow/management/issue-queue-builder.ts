import { logger, normalizeError } from "../../../utils/logger";
import type {
	PullRequestRef,
	ResolvedProjectConfig,
	RunOptions,
	RunState,
} from "../../types";
import { listRunStates, normalizeIssueKey } from "../state";
import type {
	PollingSettings,
	WorkflowIssue,
	WorkflowRuntime,
	WorkflowTaskClient,
} from "../types/workflow.types";
import {
	buildPrioritizedIssueQueue as buildPrioritizedIssueQueueHelper,
	buildReviewOnlyIssueQueue,
	dedupeIssuesByKey,
	selectIssueQueueForCycle,
	selectReviewOnlyIssueKeys,
} from "../workflow-queue";
import { usesAllProjectScope } from "./project-selection";
import { selectStaleRunIssueKeys } from "./stale-run-retry";

export class IssueQueueBuilder {
	constructor(
		private readonly config: ResolvedProjectConfig,
		private readonly options: RunOptions,
		private readonly taskClient: WorkflowTaskClient,
		private readonly polling: PollingSettings,
		private readonly runtime: WorkflowRuntime,
	) {}

	async build(): Promise<{
		issueQueue: WorkflowIssue[];
		staleRetryCount: number;
	}> {
		if (this.options.reviewOnly) {
			const runStates = await listRunStates(
				this.config.workspacePath,
				this.config.id,
			);
			const reviewOnlyIssues = await this.fetchReviewOnlyIssues(runStates);
			return {
				issueQueue: reviewOnlyIssues,
				staleRetryCount: 0,
			};
		}

		const assignedIssues = await this.taskClient.fetchWork(
			this.options.issueArg,
			{
				includeUnprojected:
					usesAllProjectScope(this.options, this.polling) &&
					!this.options.issueArg,
			},
		);
		if (this.options.issueArg !== undefined) {
			return {
				issueQueue: selectIssueQueueForCycle(
					this.options.issueArg,
					assignedIssues,
					[],
					this.options,
				),
				staleRetryCount: 0,
			};
		}
		const staleRetryIssues =
			await this.fetchStaleIssuesForRetry(assignedIssues);
		return {
			issueQueue: selectIssueQueueForCycle(
				this.options.issueArg,
				assignedIssues,
				staleRetryIssues,
				this.options,
			),
			staleRetryCount: staleRetryIssues.length,
		};
	}

	private async fetchStaleIssuesForRetry(
		assignedIssues: WorkflowIssue[],
	): Promise<WorkflowIssue[]> {
		const runStates = await listRunStates(
			this.config.workspacePath,
			this.config.id,
		);
		const staleRunKeys = selectStaleRunIssueKeys(
			runStates,
			Date.now(),
			this.polling.staleRunTimeoutMs,
		);
		const assignedIssueKeys = new Set(
			assignedIssues.map((issue) => normalizeIssueKey(issue.identifier)),
		);
		const staleIssues: WorkflowIssue[] = [];
		for (const key of staleRunKeys.filter(
			(key) => !assignedIssueKeys.has(key),
		)) {
			const issue = await this.taskClient.fetchIssueByIdentifier(key);
			if (issue) {
				staleIssues.push(toWorkflowIssue(issue));
			}
		}
		return staleIssues;
	}

	private async fetchReviewOnlyIssues(
		runStates: RunState[],
	): Promise<WorkflowIssue[]> {
		const issueKeys = selectReviewOnlyIssueKeys(runStates);
		const localIssues = await this.fetchIssuesByKey(issueKeys);
		const taskIssues = await this.taskClient.fetchReviewOnlyWork();
		const discoveredPullRequestsByIssueKey = new Map<
			string,
			PullRequestRef | undefined
		>();
		for (const issue of dedupeIssuesByKey([...localIssues, ...taskIssues])) {
			const key = normalizeIssueKey(issue.identifier);
			if (hasRunStatePullRequest(runStates, key)) {
				continue;
			}
			try {
				const discovered = await this.runtime.findOpenPullRequestForIssue(
					this.config,
					key,
					issue.branchName,
				);
				discoveredPullRequestsByIssueKey.set(key, discovered);
				if (discovered) {
					await this.taskClient.linkPullRequest?.(issue.id, discovered);
				}
			} catch (error) {
				discoveredPullRequestsByIssueKey.set(key, undefined);
				logger.warn(
					{
						projectId: this.config.id,
						issueKey: key,
						err: normalizeError(error),
					},
					"Failed to discover PR for review-only issue",
				);
			}
		}
		const built = buildReviewOnlyIssueQueue({
			runStates,
			localIssues,
			taskIssues,
			discoveredPullRequestsByIssueKey,
		});
		logReviewOnlyQueue(
			this.config.id,
			localIssues.length,
			taskIssues.length,
			built,
		);
		return built.issueQueue;
	}

	private async fetchIssuesByKey(keys: string[]): Promise<WorkflowIssue[]> {
		const issues: WorkflowIssue[] = [];
		for (const key of keys) {
			const issue = await this.taskClient.fetchIssueByIdentifier(key);
			if (issue) {
				issues.push(toWorkflowIssue(issue));
			}
		}
		return issues;
	}
}

export function buildPrioritizedIssueQueue(
	assignedIssues: WorkflowIssue[],
	staleRetryIssues: WorkflowIssue[],
): WorkflowIssue[] {
	return buildPrioritizedIssueQueueHelper(assignedIssues, staleRetryIssues);
}

function toWorkflowIssue(issue: WorkflowIssue): WorkflowIssue {
	return {
		id: issue.id,
		identifier: issue.identifier,
		branchName: issue.branchName,
		title: issue.title,
		description: issue.description,
		url: issue.url,
		projectId: issue.projectId,
		teamId: issue.teamId,
		creatorId: issue.creatorId,
		assigneeId: issue.assigneeId,
		priority: issue.priority,
		labels: issue.labels,
		state: issue.state,
	};
}

function hasRunStatePullRequest(runStates: RunState[], key: string): boolean {
	return runStates.some(
		(state) =>
			normalizeIssueKey(state.issue.key) === key &&
			Boolean(state.pullRequest?.url),
	);
}

function logReviewOnlyQueue(
	projectId: string,
	localReviewCandidates: number,
	taskReviewCandidates: number,
	built: ReturnType<typeof buildReviewOnlyIssueQueue>,
): void {
	logger.info(
		{
			projectId,
			localReviewCandidates,
			taskReviewCandidates,
			mergedReviewCandidates: built.mergedCandidateCount,
			discoveredPrCount: built.discoveredPrCount,
			skippedWithoutPr: built.skippedWithoutPr,
			queuedReviewCandidates: built.issueQueue.length,
		},
		"Built review-only candidate queue",
	);
}
