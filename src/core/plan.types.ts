import type {
	CodexUsageRecord,
	IssueRef,
	PlannedSplitTask,
	ResolvedNotificationConfig,
	RunState,
} from "./types";

export interface PlanningLinearClient {
	updateIssueDetails(
		issueId: string,
		title: string,
		description: string,
	): Promise<void>;
	markStage(issueId: string, stage: string): Promise<void>;
	comment(issueId: string, body: string): Promise<void>;
	createTodoIssueFromPlan(
		parentIssue: IssueRef,
		task: PlannedSplitTask,
	): Promise<{ identifier: string; title: string; url: string }>;
	clearWorkflowStageLabels(issueId: string): Promise<void>;
}

export interface PlannerDecision {
	complexity: "SIMPLE" | "COMPLEX";
	splitTasks: PlannedSplitTask[];
	complexityScore: number;
}

export interface PlannerIssueRefinement {
	title: string;
	description: string;
}

export interface HandlePlanningStageDeps {
	runAgentWithChatLog: (input: {
		workspacePath: string;
		projectId: string;
		issue: RunState["issue"];
		agentRole: "planning";
		skillPath: string;
		prompt: string;
		invoke: () => Promise<{
			finalMessage: string;
			stdout: string;
			sessionId?: string;
			usage?: {
				inputTokens?: number;
				outputTokens?: number;
				totalTokens?: number;
			};
		}>;
	}) => Promise<{
		finalMessage: string;
		stdout: string;
		sessionId?: string;
		usage?: {
			inputTokens?: number;
			outputTokens?: number;
			totalTokens?: number;
		};
	}>;
	appendCodexUsage: (
		state: RunState,
		stage: CodexUsageRecord["stage"],
		usage:
			| { inputTokens?: number; outputTokens?: number; totalTokens?: number }
			| undefined,
	) => void;
	saveRunState: (cwd: string, state: RunState) => Promise<void>;
	transitionStage: (state: RunState, to: RunState["stage"]) => RunState;
	safeNotifyTaskOutcome: (
		notifications: ResolvedNotificationConfig,
		state: RunState,
		outcome: "done" | "blocked",
		errorMessage?: string,
	) => Promise<void>;
	loggerInfo: (fields: Record<string, unknown>, message: string) => void;
	buildIssueJobLogFields: (
		state: RunState,
		stage: string,
		options?: { resumed?: boolean },
	) => Record<string, unknown>;
}
