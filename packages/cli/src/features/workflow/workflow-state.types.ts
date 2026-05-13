export type WorkflowStage =
	| "received"
	| "planning"
	| "implementing"
	| "pr_created"
	| "reviewing"
	| "testing"
	| "human_review"
	| "blocked"
	| "done"
	| "failed";

export interface LinearIssue {
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
	state: {
		id: string;
		name: string;
	};
	labels: Array<{
		id: string;
		name: string;
	}>;
}

export interface IssueRef {
	id: string;
	key: string;
	title: string;
	description?: string;
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
	stage: "planning" | "implementing" | "testing";
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	recordedAt: string;
}

export type AgentChatLogRole =
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
	planSummary?: string;
	implementationSummary?: string;
	reviewSummary?: string;
	testingSummary?: string;
	successGoal?: string;
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
	pollIntervalMs?: number;
	maxPollCycles?: number;
	exitWhenIdle?: boolean;
	isolatedWorktrees?: boolean;
}
