import type { AgentBackend } from "adapters";
import type { AgentStreamEvent } from "devos-agents";
import type { CodexUsageRecord, RunState } from "../../types";
import type {
	WorkflowClarificationAnswer,
	WorkflowClarificationQuestion,
} from "./workflow-chat.types";

export type BrainstormDecision =
	| BrainstormReadyDecision
	| BrainstormNeedsInfoDecision;

export interface BrainstormReadyDecision {
	result: "ready";
	summary: string;
}

export interface BrainstormNeedsInfoDecision {
	result: "needs_info";
	questions: WorkflowClarificationQuestion[];
}

export interface BrainstormPromptOptions {
	answers?: WorkflowClarificationAnswer[];
}

export interface BrainstormTaskClient {
	listChatClarificationAnswers(
		taskId: string,
	): Promise<WorkflowClarificationAnswer[]>;
	publishChatClarification(
		taskId: string,
		questions: WorkflowClarificationQuestion[],
	): Promise<void>;
}

export interface HandleBrainstormStageDeps {
	runAgentWithChatLog: (input: {
		workspacePath: string;
		projectId: string;
		issue: RunState["issue"];
		agentRole: "brainstorm";
		skillPath: string;
		prompt: string;
		invoke: (input?: {
			onStream: (event: AgentStreamEvent) => void;
		}) => Promise<{
			finalMessage: string;
			stdout: string;
			sessionId?: string;
			backend?: AgentBackend;
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
		backend?: AgentBackend;
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
		metadata?: Pick<CodexUsageRecord, "agentBackend" | "model">,
	) => void;
	saveRunState: (cwd: string, state: RunState) => Promise<void>;
	transitionStage: (state: RunState, to: RunState["stage"]) => RunState;
	loggerInfo: (fields: Record<string, unknown>, message: string) => void;
	buildIssueJobLogFields: (
		state: RunState,
		stage: string,
		options?: { resumed?: boolean },
	) => Record<string, unknown>;
}
