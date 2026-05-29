"use client";

import { create } from "zustand";
import type {
	RealtimeEvent,
	RealtimeIssueEvent,
	RealtimeProjectEvent,
} from "./types/realtime-events.types";
import type {
	RealtimeStore,
	RealtimeStoreState,
} from "./types/realtime-store.types";

const createDefaultState = (): RealtimeStoreState => ({
	status: "idle",
	lastError: null,
	lastEvent: null,
	chatStreamsByRunId: {},
	issuesById: {},
	projectsById: {},
	inboxMessagesByScope: {},
});

export const useRealtimeStore = create<RealtimeStore>((set) => ({
	...createDefaultState(),
	setConnectionStatus: (status) => {
		set({ status });
	},
	setConnectionError: (error) => {
		set({ lastError: error });
	},
	applyEvent: (event) => {
		set((state) => applyRealtimeEvent(state, event));
	},
	resetRealtimeState: () => {
		set(createDefaultState());
	},
}));

export function inboxScopeKey(scope: {
	workspaceId: string;
	userId: string;
	runId: string;
}): string {
	return `${scope.workspaceId}:${scope.userId}:${scope.runId}`;
}

export function applyRealtimeEvent(
	state: RealtimeStoreState,
	event: RealtimeEvent,
): RealtimeStoreState {
	if (event.type === "issue.deleted") {
		const { [event.issue.id]: _removed, ...issuesById } = state.issuesById;
		return { ...state, lastEvent: event, issuesById };
	}
	if (isIssueEvent(event)) {
		return {
			...state,
			lastEvent: event,
			issuesById: { ...state.issuesById, [event.issue.id]: event.issue },
		};
	}
	if (event.type === "project.deleted") {
		const { [event.project.id]: _removed, ...projectsById } =
			state.projectsById;
		return { ...state, lastEvent: event, projectsById };
	}
	if (isProjectEvent(event)) {
		return {
			...state,
			lastEvent: event,
			projectsById: {
				...state.projectsById,
				[event.project.id]: event.project,
			},
		};
	}
	if (event.type === "task.execution.event") {
		return { ...state, lastEvent: event };
	}
	if (event.type === "chat.message.created") {
		return removeCompletedChatStream(state, event);
	}
	if (event.type === "chat.stream.started") {
		return {
			...state,
			lastEvent: event,
			chatStreamsByRunId: {
				...state.chatStreamsByRunId,
				[event.stream.runId]: {
					runId: event.stream.runId,
					sessionId: event.stream.sessionId,
					userMessageId: event.stream.userMessageId,
					content: "",
					status: event.stream.status,
					error: null,
					completedMessageId: null,
					startedAt: event.emittedAt,
					updatedAt: event.emittedAt,
				},
			},
		};
	}
	if (event.type === "chat.stream.delta") {
		const current = state.chatStreamsByRunId[event.stream.runId];
		return {
			...state,
			lastEvent: event,
			chatStreamsByRunId: {
				...state.chatStreamsByRunId,
				[event.stream.runId]: {
					runId: event.stream.runId,
					sessionId: event.stream.sessionId,
					userMessageId: current?.userMessageId ?? null,
					content: `${current?.content ?? ""}${event.stream.delta}`,
					status: "streaming",
					error: null,
					completedMessageId: null,
					startedAt: current?.startedAt ?? event.emittedAt,
					updatedAt: event.emittedAt,
				},
			},
		};
	}
	if (event.type === "chat.stream.completed") {
		const current = state.chatStreamsByRunId[event.stream.runId];
		return {
			...state,
			lastEvent: event,
			chatStreamsByRunId: {
				...state.chatStreamsByRunId,
				[event.stream.runId]: {
					runId: event.stream.runId,
					sessionId: event.stream.sessionId,
					userMessageId: current?.userMessageId ?? null,
					content: event.stream.message.content,
					status: "completed",
					error: null,
					completedMessageId: event.stream.message.id,
					startedAt: current?.startedAt ?? event.emittedAt,
					updatedAt: event.emittedAt,
				},
			},
		};
	}
	if (event.type === "chat.stream.error") {
		const current = state.chatStreamsByRunId[event.stream.runId];
		return {
			...state,
			lastEvent: event,
			chatStreamsByRunId: {
				...state.chatStreamsByRunId,
				[event.stream.runId]: {
					runId: event.stream.runId,
					sessionId: event.stream.sessionId,
					userMessageId: current?.userMessageId ?? null,
					content: current?.content ?? "",
					status: "error",
					error: event.stream.error,
					completedMessageId: null,
					startedAt: current?.startedAt ?? event.emittedAt,
					updatedAt: event.emittedAt,
				},
			},
		};
	}
	if (event.type === "inbox.message.created") {
		const key = inboxScopeKey(event.message);
		return {
			...state,
			lastEvent: event,
			inboxMessagesByScope: {
				...state.inboxMessagesByScope,
				[key]: upsertLatestMessage(
					state.inboxMessagesByScope[key] ?? [],
					event.message,
				),
			},
		};
	}
	return { ...state, lastEvent: event };
}

function removeCompletedChatStream(
	state: RealtimeStoreState,
	event: Extract<RealtimeEvent, { type: "chat.message.created" }>,
): RealtimeStoreState {
	const entries = Object.entries(state.chatStreamsByRunId).filter(
		([, stream]) => stream.completedMessageId !== event.message.id,
	);
	return {
		...state,
		lastEvent: event,
		chatStreamsByRunId: Object.fromEntries(entries),
	};
}

function isIssueEvent(event: RealtimeEvent): event is RealtimeIssueEvent {
	return event.type.startsWith("issue.");
}

function isProjectEvent(event: RealtimeEvent): event is RealtimeProjectEvent {
	return event.type.startsWith("project.");
}

function upsertLatestMessage<T extends { id: string }>(
	items: T[],
	item: T,
): T[] {
	return [item, ...items.filter((current) => current.id !== item.id)];
}
