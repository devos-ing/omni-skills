import { describe, expect, it } from "bun:test";
import type { ChatMessageRecord, ChatSessionRecord } from "../src/lib/api";
import { serverStateQueryKeys } from "../src/lib/api/query-keys";
import { parseRealtimeEvent } from "../src/lib/realtime";
import { applyRealtimeEventToQueryClient } from "../src/lib/realtime/realtime-query-bridge";
import type { RealtimeEvent } from "../src/lib/realtime/types/realtime-events.types";

describe("chat realtime events", () => {
	it("parses chat session and message event frames", () => {
		expect(
			parseRealtimeEvent(
				JSON.stringify({
					id: "event-session",
					emittedAt: "2026-05-16T00:00:00.000Z",
					type: "chat.session.created",
					session: chatSession({ id: "session-1" }),
				}),
			),
		).toMatchObject({
			type: "chat.session.created",
			session: { id: "session-1" },
		});

		expect(
			parseRealtimeEvent(
				JSON.stringify({
					id: "event-message",
					emittedAt: "2026-05-16T00:00:00.000Z",
					type: "chat.message.created",
					message: chatMessage({ id: "message-1" }),
				}),
			),
		).toMatchObject({
			type: "chat.message.created",
			message: { id: "message-1" },
		});
		expect(
			parseRealtimeEvent(
				JSON.stringify({
					id: "event-stream-started",
					emittedAt: "2026-05-16T00:00:00.000Z",
					type: "chat.stream.started",
					stream: {
						runId: "run-1",
						sessionId: "session-1",
						status: "loading",
						userMessageId: "message-user",
					},
				}),
			),
		).toMatchObject({
			type: "chat.stream.started",
			stream: { runId: "run-1", status: "loading" },
		});
		expect(
			parseRealtimeEvent(
				JSON.stringify({
					id: "event-stream-delta",
					emittedAt: "2026-05-16T00:00:00.000Z",
					type: "chat.stream.delta",
					stream: {
						runId: "run-1",
						sessionId: "session-1",
						delta: "Hello",
					},
				}),
			),
		).toMatchObject({
			type: "chat.stream.delta",
			stream: { runId: "run-1", delta: "Hello" },
		});
		expect(() =>
			parseRealtimeEvent(
				JSON.stringify({
					id: "bad",
					emittedAt: "2026-05-16T00:00:00.000Z",
					type: "chat.session.created",
					session: { id: "session-1" },
				}),
			),
		).toThrow("Invalid /api/chat/sessions response field 'workspaceId'");
		expect(() =>
			parseRealtimeEvent(
				JSON.stringify({
					id: "bad-stream",
					emittedAt: "2026-05-16T00:00:00.000Z",
					type: "chat.stream.delta",
					stream: { runId: "run-1", sessionId: "session-1" },
				}),
			),
		).toThrow("Invalid realtime event field 'delta'");
	});

	it("bridges chat events into React Query caches", () => {
		const queryClient = new FakeQueryClient();
		const older = chatSession({
			id: "session-old",
			updatedAt: "2026-05-16T00:00:00.000Z",
		});
		const newer = chatSession({
			id: "session-new",
			updatedAt: "2026-05-16T00:01:00.000Z",
		});
		const archivedOlder = chatSession({
			...older,
			archived: true,
			updatedAt: "2026-05-16T00:02:00.000Z",
		});
		const first = chatMessage({
			id: "message-1",
			createdAt: "2026-05-16T00:00:00.000Z",
		});
		const second = chatMessage({
			id: "message-2",
			createdAt: "2026-05-16T00:01:00.000Z",
		});

		applyRealtimeEventToQueryClient(queryClient as never, sessionEvent(older));
		applyRealtimeEventToQueryClient(queryClient as never, sessionEvent(newer));
		applyRealtimeEventToQueryClient(queryClient as never, sessionEvent(newer));
		applyRealtimeEventToQueryClient(
			queryClient as never,
			sessionEvent(archivedOlder),
		);
		applyRealtimeEventToQueryClient(queryClient as never, messageEvent(second));
		applyRealtimeEventToQueryClient(queryClient as never, messageEvent(first));
		applyRealtimeEventToQueryClient(queryClient as never, messageEvent(first));

		expect(
			queryClient.getQueryData<ChatSessionRecord[]>(
				serverStateQueryKeys.chatSessions("owner-1"),
			),
		).toEqual([newer]);
		expect(
			queryClient.getQueryData<ChatMessageRecord[]>(
				serverStateQueryKeys.chatMessages("session-1"),
			),
		).toEqual([first, second]);
	});
});

class FakeQueryClient {
	private readonly data = new Map<string, unknown>();

	getQueryData<T>(queryKey: readonly unknown[]): T | undefined {
		return this.data.get(JSON.stringify(queryKey)) as T | undefined;
	}

	setQueryData<T>(
		queryKey: readonly unknown[],
		value: T | ((current: T | undefined) => T),
	): void {
		const key = JSON.stringify(queryKey);
		const current = this.data.get(key) as T | undefined;
		this.data.set(
			key,
			typeof value === "function"
				? (value as (current: T | undefined) => T)(current)
				: value,
		);
	}
}

function sessionEvent(session: ChatSessionRecord): RealtimeEvent {
	return {
		id: `event-${session.id}`,
		emittedAt: session.updatedAt,
		type: "chat.session.updated",
		session,
	};
}

function messageEvent(message: ChatMessageRecord): RealtimeEvent {
	return {
		id: `event-${message.id}`,
		emittedAt: message.createdAt,
		type: "chat.message.created",
		message,
	};
}

function chatSession(
	overrides: Partial<ChatSessionRecord> = {},
): ChatSessionRecord {
	return {
		id: "session-1",
		workspaceId: "owner-1",
		projectId: "default",
		taskId: "task-1",
		title: "Untitled",
		pendingRequest: null,
		pendingQuestions: [],
		archived: false,
		workflowState: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}

function chatMessage(
	overrides: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
	return {
		id: "message-1",
		sessionId: "session-1",
		role: "user",
		kind: "message",
		content: "Build it",
		taskId: "task-1",
		commandAction: null,
		metadata: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}
