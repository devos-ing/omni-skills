import type { AgentAdapter } from "../agent-adapters";
import type { LinearClient } from "../services/linear";
import type {
	PullRequestRef,
	ResolvedNotificationEmailConfig,
	ResolvedProjectConfig,
	RunState,
} from "./types";

export interface WorkflowIssue {
	id: string;
	identifier: string;
	title: string;
	description?: string;
	url: string;
	projectId?: string;
	teamId?: string;
	creatorId?: string;
	assigneeId?: string;
	priority: {
		value: number;
		name: string;
	};
	labels: Array<{
		id: string;
		name: string;
	}>;
	state: {
		id: string;
		name: string;
	};
	pullRequest?: PullRequestRef;
}

export interface IssueProjectRoutingResult {
	selectedProjectId?: string;
	skipReason?: string;
	error?: string;
}

export interface ReviewOnlyQueueBuildResult {
	issueQueue: WorkflowIssue[];
	mergedCandidateCount: number;
	discoveredPrCount: number;
	skippedWithoutPr: number;
}

export interface PollingSettings {
	enabled: boolean;
	intervalMs: number;
	maxCycles?: number;
	exitWhenIdle: boolean;
	staleRunTimeoutMs: number;
}

export interface IssueJobLogFields {
	projectId: string;
	issueKey: string;
	issueId: string;
	issueTitle: string;
	stage: string;
	resumed?: true;
}

export type WorkflowLinearClient = Pick<
	LinearClient,
	| "fetchWork"
	| "fetchIssueByIdentifier"
	| "fetchReviewOnlyWork"
	| "isAssignedState"
	| "markStage"
	| "markCanceled"
	| "updateIssueDetails"
	| "createTodoIssueFromPlan"
	| "applyStageLabel"
	| "clearWorkflowStageLabels"
	| "comment"
>;

export interface WorkflowRuntime {
	createLinearClient(config: ResolvedProjectConfig): WorkflowLinearClient;
	createAgentAdapter(config: ResolvedProjectConfig): AgentAdapter;
	ensureBaseBranchFresh(config: ResolvedProjectConfig): Promise<void>;
	findOpenPullRequestForIssue(
		config: ResolvedProjectConfig,
		issueKey: string,
	): Promise<PullRequestRef | undefined>;
	prepareImplementationBranch(
		config: ResolvedProjectConfig,
		issueKey: string,
		pullRequest: PullRequestRef | undefined,
	): Promise<string>;
	createDraftPrFromWorktree(
		config: ResolvedProjectConfig,
		issueKey: string,
		issueTitle: string,
	): Promise<PullRequestRef>;
	updateDraftPrFromWorktree(
		config: ResolvedProjectConfig,
		prBranch: string,
		issueKey: string,
	): Promise<boolean>;
	commentOnPr(
		config: ResolvedProjectConfig,
		pr: PullRequestRef,
		body: string,
	): Promise<void>;
	markPrReadyForReview(
		config: ResolvedProjectConfig,
		pr: PullRequestRef,
	): Promise<boolean>;
	squashMergePullRequest(
		config: ResolvedProjectConfig,
		pr: PullRequestRef,
	): Promise<boolean>;
	sendTaskOutcomeEmail(
		email: ResolvedNotificationEmailConfig,
		state: RunState,
		outcome: "done" | "blocked",
		errorMessage?: string,
	): Promise<void>;
	sendHumanReviewRequiredEmail(
		email: ResolvedNotificationEmailConfig,
		state: RunState,
		input: { complexityScore: number; reason: string },
	): Promise<void>;
}
