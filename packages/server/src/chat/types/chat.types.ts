import type {
	BoardProjectRow,
	ChatMessageRow,
	ChatSessionRow,
	NewChatMessageRow,
	NewChatSessionRow,
} from "devos-db";
import type { BoardTaskApiRecord } from "../../tasks";

export type ChatMessageRole = "user" | "assistant" | "system";
export type ChatMessageKind =
	| "message"
	| "clarification"
	| "task"
	| "command"
	| "error";

export interface ChatSessionRecord
	extends Omit<ChatSessionRow, "pendingQuestions"> {
	pendingQuestions: ChatClarificationQuestion[];
}

export interface ChatClarificationOption {
	label: string;
	value: string;
	description?: string;
	recommended?: boolean;
}

export interface ChatClarificationQuestion {
	question: string;
	options?: ChatClarificationOption[];
}

export interface ChatMessageRecord extends Omit<ChatMessageRow, "metadata"> {
	metadata: Record<string, unknown> | null;
}

export interface ChatSessionCreateInput {
	projectId?: string | null;
	title?: string;
	workspaceId: string;
}

export interface ChatSessionUpdateInput {
	archived?: boolean;
	projectId?: string | null;
	taskId?: string | null;
	title?: string;
	pendingRequest?: string | null;
	pendingQuestions?: ChatClarificationQuestion[] | null;
}

export interface ChatMessageCreateInput {
	commandAction?: string | null;
	content: string;
	kind?: ChatMessageKind;
	metadata?: Record<string, unknown> | null;
	role: ChatMessageRole;
	taskId?: string | null;
}

export interface ChatAddMessageResult {
	message: ChatMessageRecord;
	session: ChatSessionRecord;
}

export interface ChatSendInput {
	answers?: ChatSendAnswer[];
	content: string;
}

export interface ChatSendResult {
	issue: BoardTaskApiRecord;
	messages: ChatMessageRecord[];
	session: ChatSessionRecord;
}

export interface ChatQueuedSendResult {
	accepted: ChatSendResult;
	completion: Promise<ChatSendResult>;
}

export interface ChatStreamStartedPayload {
	runId: string;
	sessionId: string;
	userMessageId: string;
}

export interface ChatStreamDeltaPayload {
	runId: string;
	sessionId: string;
	delta: string;
}

export interface ChatStreamCompletedPayload {
	runId: string;
	sessionId: string;
	message: ChatMessageRecord;
}

export interface ChatStreamErrorPayload {
	runId: string;
	sessionId: string;
	error: string;
}

export interface ChatSendStreamCallbacks {
	runId: string;
	onAssistantMessage?(message: ChatMessageRecord): void;
	onStreamCompleted?(payload: ChatStreamCompletedPayload): void;
	onStreamDelta?(payload: ChatStreamDeltaPayload): void;
	onStreamError?(payload: ChatStreamErrorPayload): void;
	onStreamStarted?(payload: ChatStreamStartedPayload): void;
	onUserMessage?(message: ChatMessageRecord): void;
}

export interface ChatSendAnswer {
	question: string;
	answer: string;
}

export type ChatRequirementResult =
	| {
			status: "ready";
			task: { title: string; description: string };
	  }
	| { status: "needs_info"; questions: ChatClarificationQuestion[] };

export interface ChatRequirementApplicationResult {
	assistantKind: "task" | "clarification";
	assistantText: string;
	issue: BoardTaskApiRecord;
	sessionUpdate: ChatSessionUpdateInput;
}

export interface ChatRepository {
	addMessage(
		sessionId: string,
		message: NewChatMessageRow,
	): Promise<ChatMessageRow>;
	createSession(input: NewChatSessionRow): Promise<ChatSessionRow>;
	getSession(id: string): Promise<ChatSessionRow | null>;
	listMessages(sessionId: string): Promise<ChatMessageRow[]>;
	listSessions(workspaceId: string): Promise<ChatSessionRow[]>;
	updateSession(
		id: string,
		input: Partial<NewChatSessionRow>,
	): Promise<ChatSessionRow | null>;
}

export interface ChatServiceDeps {
	ensureDefaultProject(): Promise<BoardProjectRow>;
	createIssue(input: ChatSessionIssueCreateInput): Promise<BoardTaskApiRecord>;
	getIssue(issueId: string): Promise<BoardTaskApiRecord | null>;
	resolveTaskRequirement(input: {
		answers?: ChatSendAnswer[];
		projectId?: string;
		request: string;
	}): Promise<ChatRequirementResult>;
	updateIssue(
		issueId: string,
		input: ChatSessionIssueUpdateInput,
	): Promise<BoardTaskApiRecord>;
}

export interface ChatSessionIssueCreateInput {
	content: string;
	projectId: string;
	title: string;
}

export interface ChatSessionIssueUpdateInput {
	content?: string;
	status?: string;
	title?: string;
}

export interface ChatService {
	addMessage(
		sessionId: string,
		input: ChatMessageCreateInput,
	): Promise<ChatAddMessageResult | null>;
	createSession(input: ChatSessionCreateInput): Promise<ChatSessionRecord>;
	getMessages(sessionId: string): Promise<ChatMessageRecord[] | null>;
	listSessions(workspaceId: string): Promise<ChatSessionRecord[]>;
	sendMessage(
		sessionId: string,
		input: ChatSendInput,
		stream?: ChatSendStreamCallbacks,
	): Promise<ChatSendResult | null>;
	queueMessage(
		sessionId: string,
		input: ChatSendInput,
		stream?: ChatSendStreamCallbacks,
	): Promise<ChatQueuedSendResult | null>;
	updateSession(
		sessionId: string,
		input: ChatSessionUpdateInput,
	): Promise<ChatSessionRecord | null>;
}
