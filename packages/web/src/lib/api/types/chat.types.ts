import type {
	ProjectBoardTaskRecord,
	TaskClarificationQuestion,
	TaskCreateAnswer,
} from "./task.types";

export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMessageKind =
	| "message"
	| "clarification"
	| "task"
	| "command"
	| "error";
export type ChatSessionWorkflowState =
	| "brainstorm"
	| "plan"
	| "implement"
	| "testing"
	| "done"
	| "failed"
	| "canceled";

export interface ChatSessionRecord {
	id: string;
	workspaceId: string;
	projectId: string | null;
	taskId: string | null;
	title: string;
	pendingRequest: string | null;
	pendingQuestions: TaskClarificationQuestion[];
	archived: boolean;
	workflowState: ChatSessionWorkflowState | null;
	createdAt: string;
	updatedAt: string;
}

export interface ChatMessageRecord {
	id: string;
	sessionId: string;
	role: ChatMessageRole;
	kind: ChatMessageKind;
	content: string;
	taskId: string | null;
	commandAction: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
}

export interface ChatSessionCreateRequest {
	workspaceId?: string;
	projectId?: string | null;
	title?: string;
}

export interface ChatSessionUpdateRequest {
	archived?: boolean;
	projectId?: string | null;
	title?: string;
	pendingRequest?: string | null;
	pendingQuestions?: TaskClarificationQuestion[] | null;
}

export interface ChatMessageCreateRequest {
	role: ChatMessageRole;
	kind?: ChatMessageKind;
	content: string;
	taskId?: string | null;
	commandAction?: string | null;
	metadata?: Record<string, unknown> | null;
}

export interface ChatSendRequest {
	content: string;
	answers?: TaskCreateAnswer[];
}

export interface ChatSendResponse {
	session: ChatSessionRecord;
	messages: ChatMessageRecord[];
	issue: ProjectBoardTaskRecord;
}
