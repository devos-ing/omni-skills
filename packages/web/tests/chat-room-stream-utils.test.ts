import { describe, expect, it } from "bun:test";
import { activeChatStreamSessionIds } from "../src/components/chat-room/chat-room-stream-utils";
import type { RealtimeChatStreamBuffer } from "../src/lib/realtime/types/realtime-store.types";

describe("chat room stream utilities", () => {
	it("returns session ids with active chat streams", () => {
		const sessionIds = activeChatStreamSessionIds({
			"run-1": chatStream({ runId: "run-1", sessionId: "session-1" }),
			"run-2": chatStream({
				runId: "run-2",
				sessionId: "session-2",
				status: "streaming",
			}),
			"run-3": chatStream({
				runId: "run-3",
				sessionId: "session-1",
				status: "completed",
			}),
			"run-4": chatStream({
				runId: "run-4",
				sessionId: "session-3",
				status: "error",
			}),
		});

		expect([...sessionIds]).toEqual(["session-1", "session-2"]);
	});

	it("returns no running sessions without active websocket streams", () => {
		const sessionIds = activeChatStreamSessionIds({});
		expect([...sessionIds]).toEqual([]);
	});
});

function chatStream(
	overrides: Partial<RealtimeChatStreamBuffer> = {},
): RealtimeChatStreamBuffer {
	return {
		runId: "run-1",
		sessionId: "session-1",
		userMessageId: "message-user",
		content: "",
		status: "loading",
		error: null,
		completedMessageId: null,
		startedAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}
