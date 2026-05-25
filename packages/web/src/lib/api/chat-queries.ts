"use client";

import {
	type UseMutationResult,
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { serverStateQueryKeys } from "./query-keys";
import type {
	ChatMessageCreateRequest,
	ChatMessageRecord,
	ChatSendRequest,
	ChatSendResponse,
	ChatSessionCreateRequest,
	ChatSessionRecord,
	ChatSessionUpdateRequest,
} from "./types/chat.types";
import type { ServerStateQueryOptions } from "./types/queries.types";
import type { ProjectBoardTaskRecord } from "./types/task.types";
import { createWebApiClient } from "./web-client";

const apiClient = createWebApiClient();
const DEFAULT_POLL_INTERVAL_MS = 5000;

export function useChatSessionsQuery(
	workspaceId: string,
	options?: ServerStateQueryOptions,
): UseQueryResult<ChatSessionRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.chatSessions(workspaceId),
		queryFn: () => apiClient.listChatSessions(workspaceId),
		enabled: Boolean(workspaceId) && options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useChatMessagesQuery(
	sessionId: string,
	options?: ServerStateQueryOptions,
): UseQueryResult<ChatMessageRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.chatMessages(sessionId),
		queryFn: () => apiClient.listChatMessages(sessionId),
		enabled: Boolean(sessionId) && options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useCreateChatSessionMutation(): UseMutationResult<
	ChatSessionRecord,
	Error,
	ChatSessionCreateRequest
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (input) => apiClient.createChatSession(input),
		onSuccess: (session) => {
			upsertSession(queryClient, session);
			invalidateIssueCollections(queryClient, session.workspaceId);
		},
	});
}

export function useUpdateChatSessionMutation(): UseMutationResult<
	ChatSessionRecord,
	Error,
	{ sessionId: string; session: ChatSessionUpdateRequest }
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ sessionId, session }) =>
			apiClient.updateChatSession(sessionId, session),
		onSuccess: (session) => upsertSession(queryClient, session),
	});
}

export function useAppendChatMessageMutation(): UseMutationResult<
	ChatMessageRecord,
	Error,
	{ sessionId: string; message: ChatMessageCreateRequest }
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ sessionId, message }) =>
			apiClient.appendChatMessage(sessionId, message),
		onSuccess: (message) => appendMessage(queryClient, message),
	});
}

export function useSendChatMessageMutation(): UseMutationResult<
	ChatSendResponse,
	Error,
	{ sessionId: string; message: ChatSendRequest }
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: ({ sessionId, message }) =>
			apiClient.sendChatMessage(sessionId, message),
		onSuccess: (response) => {
			upsertSession(queryClient, response.session);
			upsertIssue(queryClient, response.issue);
			queryClient.setQueryData<ChatMessageRecord[]>(
				serverStateQueryKeys.chatMessages(response.session.id),
				(current = []) => mergeMessages(current, response.messages),
			);
			invalidateIssueCollections(queryClient, response.session.workspaceId);
		},
	});
}

function upsertSession(
	queryClient: ReturnType<typeof useQueryClient>,
	session: ChatSessionRecord,
): void {
	queryClient.setQueryData<ChatSessionRecord[]>(
		serverStateQueryKeys.chatSessions(session.workspaceId),
		(current = []) => mergeSessions(current, [session]),
	);
}

function appendMessage(
	queryClient: ReturnType<typeof useQueryClient>,
	message: ChatMessageRecord,
): void {
	queryClient.setQueryData<ChatMessageRecord[]>(
		serverStateQueryKeys.chatMessages(message.sessionId),
		(current = []) => mergeMessages(current, [message]),
	);
}

function upsertIssue(
	queryClient: ReturnType<typeof useQueryClient>,
	issue: ProjectBoardTaskRecord,
): void {
	queryClient.setQueryData(serverStateQueryKeys.boardTask(issue.id), issue);
	queryClient.setQueryData<ProjectBoardTaskRecord[]>(
		serverStateQueryKeys.boardTasks,
		(current = []) => mergeById(current, [issue]),
	);
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.taskActivity(issue.id),
	});
}

function invalidateIssueCollections(
	queryClient: ReturnType<typeof useQueryClient>,
	workspaceId: string,
): void {
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.boardTasks,
	});
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.projectBoards,
	});
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.workspaceProjects(workspaceId),
	});
}

function mergeSessions(
	current: ChatSessionRecord[],
	next: ChatSessionRecord[],
): ChatSessionRecord[] {
	return mergeById(current, next).sort((left, right) =>
		right.updatedAt.localeCompare(left.updatedAt),
	);
}

function mergeMessages(
	current: ChatMessageRecord[],
	next: ChatMessageRecord[],
): ChatMessageRecord[] {
	return mergeById(current, next).sort((left, right) =>
		left.createdAt.localeCompare(right.createdAt),
	);
}

function mergeById<T extends { id: string }>(current: T[], next: T[]): T[] {
	const records = new Map(current.map((item) => [item.id, item]));
	for (const item of next) {
		records.set(item.id, item);
	}
	return [...records.values()];
}

function resolveRefetchInterval(
	options?: ServerStateQueryOptions,
): number | false {
	return options?.refetchIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
}
