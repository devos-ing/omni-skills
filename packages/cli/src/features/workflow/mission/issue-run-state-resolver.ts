import type {
	ResolvedProjectConfig,
	RunOptions,
	RunState,
	WorkflowStage,
} from "../../types";
import {
	loadRunState,
	normalizeBlockedPlanningFailureForResume,
	normalizeIssueKey,
	saveRunState,
} from "../state";
import type {
	IssueLogger,
	IssueRunStateResolution,
} from "../types/issue-processing.types";
import type {
	WorkflowIssue,
	WorkflowTaskClient,
} from "../types/workflow.types";
import {
	isCanceledWorkflowIssueState,
	matchesIssueStateValue,
} from "../workflow-issue-state";
import {
	isReviewOnlyExecutableStage,
	shouldSkipReviewOnlyRunState,
} from "../workflow-queue";
import { refreshRunStateIssueIdentity } from "../workflow-run-state-refresh";

export function resolveReviewOnlyBootstrapStage(
	state: WorkflowIssue["state"],
): WorkflowStage {
	if (matchesIssueStateValue(state, "done")) {
		return "done";
	}
	return "in_review";
}

export class IssueRunStateResolver {
	constructor(
		private readonly config: ResolvedProjectConfig,
		private readonly taskClient: WorkflowTaskClient,
		private readonly options: RunOptions,
		private readonly issueLogger: IssueLogger,
	) {}

	async resolve(issue: WorkflowIssue): Promise<IssueRunStateResolution | null> {
		const key = normalizeIssueKey(issue.identifier);
		const loadedRunState = await loadRunState(
			this.config.workspacePath,
			this.config.id,
			key,
		);
		const identityRefresh = loadedRunState
			? refreshRunStateIssueIdentity(loadedRunState, issue)
			: undefined;
		if (identityRefresh && !identityRefresh.reusable) {
			const message =
				identityRefresh.discardReason === "task_not_found_block"
					? "Discarding stale local run state because server task is available again"
					: "Discarding stale local run state because server task identity changed";
			this.issueLogger.warn(
				{
					previousIssueId: identityRefresh.previousIssueId,
					issueId: identityRefresh.currentIssueId,
				},
				message,
			);
		}
		const existing =
			identityRefresh?.reusable === false ? null : loadedRunState;
		if (shouldSkipReviewOnlyRunState(existing, this.options)) {
			this.issueLogger.info(
				{ stage: existing?.stage },
				"Skipping review-only issue parked for manual review",
			);
			return null;
		}

		const isAssignedState = await this.taskClient.isAssignedState(
			issue.state.id,
		);
		const isCanceledState = isCanceledWorkflowIssueState(issue.state);
		if (
			!existing &&
			!isAssignedState &&
			!this.options.reviewOnly &&
			!(this.options.issueArg && isCanceledState)
		) {
			this.issueLogger.info(
				{ issueState: issue.state.name, issueStateId: issue.state.id },
				"Skipping in-progress issue without resumable local run state",
			);
			return null;
		}

		const runState = this.buildRunState(issue, key, existing);
		await this.refreshStoredIdentity(runState, identityRefresh);
		Object.assign(runState, normalizeBlockedPlanningFailureForResume(runState));
		if (runState.stage === "brainstorm" && isAssignedState) {
			runState.brainstormNeedsInfoQuestions = undefined;
		}
		this.prepareReviewOnlyState(issue, runState);
		return { runState, existing, isCanceledState };
	}

	private buildRunState(
		issue: WorkflowIssue,
		key: string,
		existing: IssueRunStateResolution["existing"],
	): RunState {
		return (
			existing ??
			({
				projectId: this.config.id,
				projectName: this.config.name,
				workspacePath: this.config.executionPath,
				repository: {
					owner: this.config.repo.owner,
					name: this.config.repo.name,
					baseBranch: this.config.repo.baseBranch,
				},
				issue: {
					id: issue.id,
					key,
					branchName: issue.branchName,
					title: issue.title,
					description: issue.description,
					url: issue.url,
					projectId: issue.projectId,
					teamId: issue.teamId,
					creatorId: issue.creatorId,
					assigneeId: issue.assigneeId,
					parentIssue: issue.parentIssue,
				},
				stage: this.options.reviewOnly
					? resolveReviewOnlyBootstrapStage(issue.state)
					: "brainstorm",
				reviewMode: this.options.reviewOnly ? "bot" : undefined,
				pullRequest: issue.pullRequest,
				bugs: [],
				startedAt: new Date().toISOString(),
				updatedAt: new Date().toISOString(),
			} satisfies RunState)
		);
	}

	private async refreshStoredIdentity(
		runState: RunState,
		identityRefresh:
			| ReturnType<typeof refreshRunStateIssueIdentity>
			| undefined,
	): Promise<void> {
		if (!identityRefresh?.reusable || !identityRefresh.changed) {
			return;
		}
		this.issueLogger.info(
			{
				previousIssueId: identityRefresh.previousIssueId,
				issueId: identityRefresh.currentIssueId,
			},
			"Refreshed resumed issue identity from latest task",
		);
		await saveRunState(this.config.workspacePath, runState);
	}

	private prepareReviewOnlyState(
		issue: WorkflowIssue,
		runState: RunState,
	): void {
		if (
			this.options.reviewOnly &&
			issue.pullRequest?.url &&
			!runState.pullRequest?.url
		) {
			runState.pullRequest = issue.pullRequest;
		}
		if (
			this.options.reviewOnly &&
			!isReviewOnlyExecutableStage(runState.stage)
		) {
			runState.stage = resolveReviewOnlyBootstrapStage(issue.state);
		}
		if (this.options.reviewOnly && !runState.reviewMode) {
			runState.reviewMode = "bot";
		}
	}
}
