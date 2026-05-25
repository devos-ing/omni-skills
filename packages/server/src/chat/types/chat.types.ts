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
	pendingQuestions: string[];
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
	projectId?: string | null;
	taskId?: string | null;
	title?: string;
	pendingRequest?: string | null;
	pendingQuestions?: string[] | null;
}

export interface ChatMessageCreateInput {
	commandAction?: string | null;
	content: string;
	kind?: ChatMessageKind;
	metadata?: Record<string, unknown> | null;
	role: ChatMessageRole;
	taskId?: string | null;
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

export interface ChatSendAnswer {
	question: string;
	answer: string;
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
	title?: string;
}

export interface ChatService {
	addMessage(
		sessionId: string,
		input: ChatMessageCreateInput,
	): Promise<ChatMessageRecord | null>;
	createSession(input: ChatSessionCreateInput): Promise<ChatSessionRecord>;
	getMessages(sessionId: string): Promise<ChatMessageRecord[] | null>;
	listSessions(workspaceId: string): Promise<ChatSessionRecord[]>;
	sendMessage(
		sessionId: string,
		input: ChatSendInput,
	): Promise<ChatSendResult | null>;
	updateSession(
		sessionId: string,
		input: ChatSessionUpdateInput,
	): Promise<ChatSessionRecord | null>;
}
