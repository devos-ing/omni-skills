"use client";

import type { QueryClient } from "@tanstack/react-query";
import type {
	ChatMessageRecord,
	ChatSessionRecord,
	InboxMessageRecord,
	ProjectBoardTaskRecord,
	WorkspaceProjectRecord,
} from "../api";
import { mergeChatSessions } from "../api/chat-session-cache";
import { serverStateQueryKeys } from "../api/query-keys";
import type {
	RealtimeEvent,
	RealtimeIssueEvent,
	RealtimeProjectEvent,
} from "./types/realtime-events.types";

export function applyRealtimeEventToQueryClient(
	queryClient: QueryClient,
	event: RealtimeEvent,
): void {
	if (event.type === "issue.deleted") {
		removeIssue(queryClient, event.issue);
		return;
	}
	if (isIssueEvent(event)) {
		upsertIssue(queryClient, event.issue);
		return;
	}
	if (event.type === "project.deleted") {
		removeProject(queryClient, event.project);
		return;
	}
	if (isProjectEvent(event)) {
		upsertProject(queryClient, event.project);
		return;
	}
	if (
		event.type === "chat.session.created" ||
		event.type === "chat.session.updated"
	) {
		upsertChatSession(queryClient, event.session);
		return;
	}
	if (event.type === "chat.message.created") {
		upsertChatMessage(queryClient, event.message);
		return;
	}
	if (event.type.startsWith("chat.stream.")) {
		return;
	}
	if (event.type === "task.execution.event") {
		void queryClient.invalidateQueries({
			queryKey: serverStateQueryKeys.taskActivity(event.execution.taskId),
		});
		return;
	}
	if (event.type === "polling.event") {
		void queryClient.invalidateQueries({
			queryKey: serverStateQueryKeys.pollingStatus,
		});
		return;
	}
	if (event.type === "inbox.message.created") {
		prependInboxMessage(queryClient, event.message);
	}
}

function isIssueEvent(event: RealtimeEvent): event is RealtimeIssueEvent {
	return event.type.startsWith("issue.");
}

function isProjectEvent(event: RealtimeEvent): event is RealtimeProjectEvent {
	return event.type.startsWith("project.");
}

function upsertIssue(
	queryClient: QueryClient,
	issue: ProjectBoardTaskRecord,
): void {
	queryClient.setQueryData(serverStateQueryKeys.boardTask(issue.id), issue);
	queryClient.setQueryData<ProjectBoardTaskRecord[]>(
		serverStateQueryKeys.boardTasks,
		(current = []) => upsertById(current, issue),
	);
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.projectBoards,
	});
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.taskActivity(issue.id),
	});
}

function removeIssue(
	queryClient: QueryClient,
	issue: ProjectBoardTaskRecord,
): void {
	queryClient.removeQueries({
		queryKey: serverStateQueryKeys.boardTask(issue.id),
	});
	queryClient.setQueryData<ProjectBoardTaskRecord[]>(
		serverStateQueryKeys.boardTasks,
		(current = []) => current.filter((item) => item.id !== issue.id),
	);
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.projectBoards,
	});
	void queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.taskActivity(issue.id),
	});
}

function upsertProject(
	queryClient: QueryClient,
	project: WorkspaceProjectRecord,
): void {
	queryClient.setQueryData<WorkspaceProjectRecord[]>(
		serverStateQueryKeys.workspaceProjects(project.workspaceId),
		(current = []) => upsertById(current, project),
	);
}

function removeProject(
	queryClient: QueryClient,
	project: WorkspaceProjectRecord,
): void {
	queryClient.setQueryData<WorkspaceProjectRecord[]>(
		serverStateQueryKeys.workspaceProjects(project.workspaceId),
		(current = []) => current.filter((item) => item.id !== project.id),
	);
	queryClient.removeQueries({
		queryKey: serverStateQueryKeys.projectBoard(
			project.workspaceId,
			project.id,
		),
	});
}

function upsertChatSession(
	queryClient: QueryClient,
	session: ChatSessionRecord,
): void {
	queryClient.setQueryData<ChatSessionRecord[]>(
		serverStateQueryKeys.chatSessions(session.workspaceId),
		(current = []) => mergeChatSessions(current, [session]),
	);
}

function upsertChatMessage(
	queryClient: QueryClient,
	message: ChatMessageRecord,
): void {
	queryClient.setQueryData<ChatMessageRecord[]>(
		serverStateQueryKeys.chatMessages(message.sessionId),
		(current = []) =>
			upsertById(current, message).sort((left, right) =>
				left.createdAt.localeCompare(right.createdAt),
			),
	);
}

function prependInboxMessage(
	queryClient: QueryClient,
	message: InboxMessageRecord,
): void {
	queryClient.setQueryData<InboxMessageRecord[]>(
		serverStateQueryKeys.inboxMessages(message),
		(current = []) => upsertLatest(current, message),
	);
}

function upsertById<T extends { id: string }>(items: T[], item: T): T[] {
	const exists = items.some((current) => current.id === item.id);
	return exists
		? items.map((current) => (current.id === item.id ? item : current))
		: [...items, item];
}

function upsertLatest<T extends { id: string }>(items: T[], item: T): T[] {
	return [item, ...items.filter((current) => current.id !== item.id)];
}
