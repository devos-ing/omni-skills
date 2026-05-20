import { createAgentAdapter } from "adapters";
import {
	commentOnPr,
	createDraftPrFromWorktree,
	ensureBaseBranchFresh,
	ensureIssueWorktree,
	findOpenPullRequestForIssue,
	getPullRequestMergeStatus,
	markPrReadyForReview,
	prepareImplementationBranch,
	prepareWorktreeDependencies,
	removeIssueWorktree,
	squashMergePullRequest,
	updateDraftPrFromWorktree,
} from "../../integrations/github";
import {
	sendHumanReviewRequiredEmail,
	sendTaskOutcomeEmail,
} from "../../integrations/notifications";
import { createBoardTaskWorkflowClient } from "./board-task-workflow-client";
import type { WorkflowRuntime } from "./workflow.types";
export type { WorkflowLinearClient, WorkflowRuntime } from "./workflow.types";

export function createWorkflowRuntime(
	overrides: Partial<WorkflowRuntime> = {},
): WorkflowRuntime {
	return {
		createLinearClient: createBoardTaskWorkflowClient,
		createAgentAdapter: createAgentAdapter,
		ensureBaseBranchFresh,
		ensureIssueWorktree,
		prepareWorktreeDependencies,
		findOpenPullRequestForIssue,
		getPullRequestMergeStatus,
		prepareImplementationBranch,
		removeIssueWorktree,
		createDraftPrFromWorktree,
		updateDraftPrFromWorktree,
		commentOnPr,
		markPrReadyForReview,
		squashMergePullRequest,
		sendTaskOutcomeEmail: sendTaskOutcomeEmail,
		sendHumanReviewRequiredEmail: sendHumanReviewRequiredEmail,
		...overrides,
	};
}
