import {
	assertObjectRecord,
	encodePathSegment,
	parseListResponse,
	readNullableString,
	readString,
} from "./response-utils";
import { parseProjectBoardTaskRecord } from "./task-client";
import type {
	ChatMessageCreateRequest,
	ChatMessageKind,
	ChatMessageRecord,
	ChatMessageRole,
	ChatSendRequest,
	ChatSendResponse,
	ChatSessionCreateRequest,
	ChatSessionRecord,
	ChatSessionUpdateRequest,
} from "./types/chat.types";
import type { HealthRequestOptions } from "./types/client.types";

const CHAT_SESSIONS_PATH = "/api/chat/sessions";

type RequestWithBase = (
	path: string,
	method: "GET" | "POST" | "PATCH" | "DELETE",
	options?: HealthRequestOptions,
	body?: unknown,
) => Promise<unknown>;

export interface ChatApiMethods {
	listChatSessions(
		workspaceId: string,
		options?: HealthRequestOptions,
	): Promise<ChatSessionRecord[]>;
	createChatSession(
		request: ChatSessionCreateRequest,
		options?: HealthRequestOptions,
	): Promise<ChatSessionRecord>;
	updateChatSession(
		sessionId: string,
		request: ChatSessionUpdateRequest,
		options?: HealthRequestOptions,
	): Promise<ChatSessionRecord>;
	listChatMessages(
		sessionId: string,
		options?: HealthRequestOptions,
	): Promise<ChatMessageRecord[]>;
	appendChatMessage(
		sessionId: string,
		request: ChatMessageCreateRequest,
		options?: HealthRequestOptions,
	): Promise<ChatMessageRecord>;
	sendChatMessage(
		sessionId: string,
		request: ChatSendRequest,
		options?: HealthRequestOptions,
	): Promise<ChatSendResponse>;
}

export function createChatApiMethods(
	requestWithBase: RequestWithBase,
): ChatApiMethods {
	return {
		async listChatSessions(workspaceId, options) {
			const path = `${CHAT_SESSIONS_PATH}?workspaceId=${encodeURIComponent(
				workspaceId,
			)}`;
			const payload = await requestWithBase(path, "GET", options);
			return parseListResponse(payload, path, parseChatSessionRecord);
		},
		async createChatSession(request, options) {
			const payload = await requestWithBase(
				CHAT_SESSIONS_PATH,
				"POST",
				options,
				request,
			);
			return parseChatSessionRecord(payload);
		},
		async updateChatSession(sessionId, request, options) {
			const payload = await requestWithBase(
				chatSessionPath(sessionId),
				"PATCH",
				options,
				request,
			);
			return parseChatSessionRecord(payload);
		},
		async listChatMessages(sessionId, options) {
			const payload = await requestWithBase(
				chatMessagesPath(sessionId),
				"GET",
				options,
			);
			return parseListResponse(
				payload,
				chatMessagesPath(sessionId),
				parseChatMessageRecord,
			);
		},
		async appendChatMessage(sessionId, request, options) {
			const payload = await requestWithBase(
				chatMessagesPath(sessionId),
				"POST",
				options,
				request,
			);
			return parseChatMessageRecord(payload);
		},
		async sendChatMessage(sessionId, request, options) {
			const payload = await requestWithBase(
				`${chatSessionPath(sessionId)}/send`,
				"POST",
				options,
				request,
			);
			return parseChatSendResponse(payload);
		},
	};
}

export function parseChatSessionRecord(payload: unknown): ChatSessionRecord {
	const row = assertObjectRecord(payload, CHAT_SESSIONS_PATH);
	return {
		id: readString(row, "id", CHAT_SESSIONS_PATH),
		workspaceId: readString(row, "workspaceId", CHAT_SESSIONS_PATH),
		projectId: readNullableString(row, "projectId", CHAT_SESSIONS_PATH),
		taskId: readNullableString(row, "taskId", CHAT_SESSIONS_PATH),
		title: readString(row, "title", CHAT_SESSIONS_PATH),
		pendingRequest: readNullableString(
			row,
			"pendingRequest",
			CHAT_SESSIONS_PATH,
		),
		pendingQuestions: readStringList(row.pendingQuestions),
		createdAt: readString(row, "createdAt", CHAT_SESSIONS_PATH),
		updatedAt: readString(row, "updatedAt", CHAT_SESSIONS_PATH),
	};
}

export function parseChatMessageRecord(payload: unknown): ChatMessageRecord {
	const row = assertObjectRecord(payload, chatMessagesPath(":sessionId"));
	return {
		id: readString(row, "id", CHAT_SESSIONS_PATH),
		sessionId: readString(row, "sessionId", CHAT_SESSIONS_PATH),
		role: readEnum(row.role, ["user", "assistant", "system"], "role"),
		kind: readEnum(
			row.kind,
			["message", "clarification", "task", "command", "error"],
			"kind",
		),
		content: readString(row, "content", CHAT_SESSIONS_PATH),
		taskId: readNullableString(row, "taskId", CHAT_SESSIONS_PATH),
		commandAction: readNullableString(row, "commandAction", CHAT_SESSIONS_PATH),
		metadata: readMetadata(row.metadata),
		createdAt: readString(row, "createdAt", CHAT_SESSIONS_PATH),
	};
}

function parseChatSendResponse(payload: unknown): ChatSendResponse {
	const row = assertObjectRecord(payload, `${CHAT_SESSIONS_PATH}/:id/send`);
	return {
		session: parseChatSessionRecord(row.session),
		messages: parseListResponse(
			row.messages,
			`${CHAT_SESSIONS_PATH}/:id/send:messages`,
			parseChatMessageRecord,
		),
		issue: parseProjectBoardTaskRecord(row.issue),
	};
}

function chatSessionPath(sessionId: string): string {
	return `${CHAT_SESSIONS_PATH}/${encodePathSegment(sessionId)}`;
}

function chatMessagesPath(sessionId: string): string {
	return `${chatSessionPath(sessionId)}/messages`;
}

function readStringList(value: unknown): string[] {
	if (
		!Array.isArray(value) ||
		!value.every((item) => typeof item === "string")
	) {
		throw new Error("Invalid chat session field 'pendingQuestions'");
	}
	return value;
}

function readMetadata(value: unknown): Record<string, unknown> | null {
	if (value === null) {
		return null;
	}
	if (typeof value === "object" && value !== null && !Array.isArray(value)) {
		return value as Record<string, unknown>;
	}
	throw new Error("Invalid chat message field 'metadata'");
}

function readEnum<T extends string>(
	value: unknown,
	values: readonly T[],
	field: string,
): T {
	if (typeof value === "string" && values.includes(value as T)) {
		return value as T;
	}
	throw new Error(`Invalid chat message field '${field}'`);
}
