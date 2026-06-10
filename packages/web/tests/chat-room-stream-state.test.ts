import { describe, expect, it } from "bun:test";
import { resolveChatRoomStreamState } from "../src/components/chat-room/chat-room-stream-state";
import type { RealtimeChatStreamBuffer } from "../src/lib/realtime/types/realtime-store.types";

describe("chat room stream state", () => {
	it("uses active websocket streams as the loading section timer source", () => {
		const state = resolveChatRoomStreamState(
			[],
			{
				"run-1": chatStream({
					content: "",
					status: "loading",
				}),
			},
			"session-1",
			false,
		);

		expect(state.isThinking).toBe(true);
		expect(state.activityStartedAt).toBe("2026-05-16T00:00:00.000Z");
	});

	it("keeps the section timer after loading becomes streamed output", () => {
		const state = resolveChatRoomStreamState(
			[],
			{
				"run-1": chatStream({
					content: "Writing task details",
					status: "streaming",
					updatedAt: "2026-05-16T00:00:03.000Z",
				}),
			},
			"session-1",
			false,
		);

		expect(state.isThinking).toBe(false);
		expect(state.streamLines).toMatchObject([
			{ id: "run-1", text: "Writing task details" },
		]);
		expect(state.activityStartedAt).toBe("2026-05-16T00:00:00.000Z");
	});

	it("splits streamed chat processing content into message rows", () => {
		const state = resolveChatRoomStreamState(
			[],
			{
				"run-1": chatStream({
					content: "Reading files...\nRunning focused tests...",
					status: "streaming",
					updatedAt: "2026-05-16T00:00:03.000Z",
				}),
			},
			"session-1",
			false,
		);

		expect(state.streamLines).toMatchObject([
			{ id: "run-1:0", text: "Reading files..." },
			{ id: "run-1:1", text: "Running focused tests..." },
		]);
	});
});

function chatStream(
	overrides: Partial<RealtimeChatStreamBuffer>,
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
