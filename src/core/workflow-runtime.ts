import { createAgentAdapter } from "../agent-adapters";
import {
	commentOnPr,
	createDraftPrFromWorktree,
	ensureBaseBranchFresh,
	findOpenPullRequestForIssue,
	markPrReadyForReview,
	prepareImplementationBranch,
	squashMergePullRequest,
	updateDraftPrFromWorktree,
} from "../services/github";
import { LinearClient } from "../services/linear";
import {
	sendHumanReviewRequiredEmail,
	sendTaskOutcomeEmail,
} from "../services/notifications";
import type { WorkflowRuntime } from "./workflow.types";
export type { WorkflowLinearClient, WorkflowRuntime } from "./workflow.types";

export function createWorkflowRuntime(
	overrides: Partial<WorkflowRuntime> = {},
): WorkflowRuntime {
	return {
		createLinearClient: (config) => new LinearClient(config),
		createAgentAdapter,
		ensureBaseBranchFresh,
		findOpenPullRequestForIssue,
		prepareImplementationBranch,
		createDraftPrFromWorktree,
		updateDraftPrFromWorktree,
		commentOnPr,
		markPrReadyForReview,
		squashMergePullRequest,
		sendTaskOutcomeEmail,
		sendHumanReviewRequiredEmail,
		...overrides,
	};
}
