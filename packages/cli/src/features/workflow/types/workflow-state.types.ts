import type { WorkflowClarificationQuestion } from "./workflow-chat.types";

export type WorkflowStage =
	| "backlog"
	| "brainstorm"
	| "plan"
	| "in_progress"
	| "in_review"
	| "canceled"
	| "done"
	| "failed";

export interface WorkflowTaskRecord {
	id: string;
	identifier: string;
	title: string;
	description?: string;
	url: string;
	projectId?: string;
	teamId?: string;
	creatorId?: string;
	assigneeId?: string;
	parentIssue?: ParentIssueRef;
	priority: {
		value: number;
		name: string;
	};
	state: {
		id: string;
		name: string;
	};
	labels: Array<{
		id: string;
		name: string;
	}>;
}

export interface CreatedTaskRef {
	id: string;
	identifier: string;
	title: string;
	url: string;
}

export interface IssueRef {
	id: string;
	key: string;
	branchName?: string;
	title: string;
	description?: string;
	url: string;
	projectId?: string;
	teamId?: string;
	creatorId?: string;
	assigneeId?: string;
	parentIssue?: ParentIssueRef;
}

export interface ParentIssueRef {
	id: string;
	key: string;
	title: string;
	url: string;
	projectId?: string;
	teamId?: string;
	creatorId?: string;
	assigneeId?: string;
}

export interface PullRequestRef {
	number?: number;
	url?: string;
	branch: string;
	title: string;
}

export interface BugRecord {
	title: string;
	body: string;
	issueUrl?: string;
}

export interface PlannedSplitTask {
	title: string;
	description?: string;
	labels?: string[];
	priority?: number;
}

export interface SplitTaskRef {
	title: string;
	issueKey?: string;
	issueUrl?: string;
}

export interface CodexUsageRecord {
	stage: "brainstorming" | "planning" | "implementing" | "testing";
	agentBackend?: string;
	model?: string;
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	estimatedCostMicrousd?: number;
	recordedAt: string;
}

export type AgentChatLogRole =
	| "brainstorm"
	| "planning"
	| "implementing"
	| "review-testing"
	| "github-comment";

export interface AgentChatLogUsage {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}

export interface AgentChatLogEntry {
	projectId: string;
	issueKey: string;
	issueId: string;
	issueTitle: string;
	agentRole: AgentChatLogRole;
	skillPath: string;
	prompt: string;
	finalMessage: string;
	stdout: string;
	sessionId?: string;
	usage?: AgentChatLogUsage;
	success: boolean;
	error?: string;
	recordedAt: string;
}

export interface RunLease {
	ownerId: string;
	acquiredAt: string;
	heartbeatAt: string;
	expiresAt: string;
}

export interface RunState {
	projectId: string;
	projectName: string;
	workspacePath: string;
	repository: {
		owner: string;
		name: string;
		baseBranch: string;
	};
	issue: IssueRef;
	stage: WorkflowStage;
	failedStage?: WorkflowStage;
	codexSessionId?: string;
	reviewSessionId?: string;
	brainstormSummary?: string;
	planSummary?: string;
	implementationSummary?: string;
	reviewSummary?: string;
	testingSummary?: string;
	successGoal?: string;
	brainstormNeedsInfoQuestions?: WorkflowClarificationQuestion[];
	planningNeedsInfoQuestions?: string[];
	complexityScore?: number;
	reviewMode?: "bot" | "human";
	automatedReviewFixPasses?: number;
	humanReviewNotifiedAt?: string;
	pullRequestApprovedAt?: string;
	pullRequest?: PullRequestRef;
	bugs: BugRecord[];
	splitTasks?: SplitTaskRef[];
	codexUsage?: CodexUsageRecord[];
	lease?: RunLease;
	executionWorkspace?: {
		mode: "git-worktree";
		path: string;
		branch: string;
		createdAt: string;
	};
	startedAt: string;
	updatedAt: string;
	lastError?: string;
}

export interface RunOptions {
	issueArg?: string;
	projectId?: string;
	allProjects?: boolean;
	concurrency?: number;
	reviewOnly?: boolean;
	poll?: boolean;
	pollForever?: boolean;
	pollIntervalMs?: number;
	maxPollCycles?: number;
	exitWhenIdle?: boolean;
	isolatedWorktrees?: boolean;
}
