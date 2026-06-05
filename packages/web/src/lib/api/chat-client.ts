import {
	parseChatMessageRecord,
	parseChatSendResponse,
	parseChatSessionRecord,
} from "./chat-response-parsers";
import { encodePathSegment, parseListResponse } from "./response-utils";
import type {
	ChatMessageCreateRequest,
	ChatMessageRecord,
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

function chatSessionPath(sessionId: string): string {
	return `${CHAT_SESSIONS_PATH}/${encodePathSegment(sessionId)}`;
}

function chatMessagesPath(sessionId: string): string {
	return `${chatSessionPath(sessionId)}/messages`;
}
