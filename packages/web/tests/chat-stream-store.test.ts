import { describe, expect, it } from "bun:test";
import type { ChatMessageRecord } from "../src/lib/api";
import { applyRealtimeEvent } from "../src/lib/realtime";
import type { RealtimeEvent } from "../src/lib/realtime/types/realtime-events.types";
import type { RealtimeStoreState } from "../src/lib/realtime/types/realtime-store.types";

describe("chat stream realtime store", () => {
	it("keeps transient buffers until the final message arrives", () => {
		let state = createRealtimeState();
		const completedMessage = chatMessage({
			id: "assistant-message",
			content: "Updated task TASK(owner-1)-1: Build it",
		});

		state = applyRealtimeEvent(state, chatStreamStartedEvent());
		expect(state.chatStreamsByRunId["run-1"]).toMatchObject({
			content: "",
			sessionId: "session-1",
			startedAt: "2026-05-16T00:00:00.000Z",
			status: "loading",
		});
		state = applyRealtimeEvent(state, chatStreamDeltaEvent("Updated task "));
		state = applyRealtimeEvent(
			state,
			chatStreamDeltaEvent("TASK(owner-1)-1: Build it"),
		);

		expect(state.chatStreamsByRunId["run-1"]).toMatchObject({
			content: "Updated task TASK(owner-1)-1: Build it",
			sessionId: "session-1",
			startedAt: "2026-05-16T00:00:00.000Z",
			status: "streaming",
			updatedAt: "2026-05-16T00:00:01.000Z",
		});

		state = applyRealtimeEvent(
			state,
			chatStreamCompletedEvent(completedMessage),
		);
		expect(state.chatStreamsByRunId["run-1"]).toMatchObject({
			completedMessageId: "assistant-message",
			status: "completed",
		});

		state = applyRealtimeEvent(state, messageEvent(completedMessage));
		expect(state.chatStreamsByRunId).toEqual({});
	});

	it("keeps unrelated session stream events isolated", () => {
		let state = createRealtimeState();
		state = applyRealtimeEvent(state, chatStreamDeltaEvent("hello"));
		state = applyRealtimeEvent(state, {
			id: "event-other",
			emittedAt: "2026-05-16T00:00:01.000Z",
			type: "chat.stream.delta",
			stream: { runId: "run-2", sessionId: "session-2", delta: "other" },
		});

		expect(Object.values(state.chatStreamsByRunId)).toMatchObject([
			{ content: "hello", sessionId: "session-1" },
			{ content: "other", sessionId: "session-2" },
		]);
	});
});

function chatStreamStartedEvent(): RealtimeEvent {
	return {
		id: "event-started",
		emittedAt: "2026-05-16T00:00:00.000Z",
		type: "chat.stream.started",
		stream: {
			runId: "run-1",
			sessionId: "session-1",
			status: "loading",
			userMessageId: "message-user",
		},
	};
}

function chatStreamDeltaEvent(delta: string): RealtimeEvent {
	return {
		id: `event-delta-${delta.length}`,
		emittedAt: "2026-05-16T00:00:01.000Z",
		type: "chat.stream.delta",
		stream: { runId: "run-1", sessionId: "session-1", delta },
	};
}

function chatStreamCompletedEvent(message: ChatMessageRecord): RealtimeEvent {
	return {
		id: "event-completed",
		emittedAt: "2026-05-16T00:00:02.000Z",
		type: "chat.stream.completed",
		stream: { runId: "run-1", sessionId: "session-1", message },
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

function chatMessage(
	overrides: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
	return {
		id: "message-1",
		sessionId: "session-1",
		role: "assistant",
		kind: "task",
		content: "Updated task TASK(owner-1)-1: Build it",
		taskId: "task-1",
		commandAction: null,
		metadata: null,
		createdAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}

function createRealtimeState(): RealtimeStoreState {
	return {
		status: "idle",
		lastError: null,
		lastEvent: null,
		chatStreamsByRunId: {},
		issuesById: {},
		projectsById: {},
		inboxMessagesByScope: {},
	};
}
