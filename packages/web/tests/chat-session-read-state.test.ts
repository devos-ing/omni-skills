import { describe, expect, it } from "bun:test";
import {
	isChatSessionUnread,
	resolveChatSessionSeenUpdate,
	resolveSelectedChatSessionSeenUpdate,
} from "../src/components/chat-room/chat-session-read-state";
import type { ChatSessionRecord } from "../src/lib/api";

describe("chat session read state", () => {
	it("marks sessions unread when updated after the last seen marker", () => {
		const session = chatSession({
			updatedAt: "2026-05-20T00:02:00.000Z",
			lastSeenAt: "2026-05-20T00:01:00.000Z",
		});

		expect(isChatSessionUnread(session)).toBe(true);
		expect(resolveChatSessionSeenUpdate(session)).toEqual({
			lastSeenAt: "2026-05-20T00:02:00.000Z",
		});
	});

	it("keeps sessions read when the marker matches the latest update", () => {
		const session = chatSession({
			updatedAt: "2026-05-20T00:02:00.000Z",
			lastSeenAt: "2026-05-20T00:02:00.000Z",
		});

		expect(isChatSessionUnread(session)).toBe(false);
		expect(resolveChatSessionSeenUpdate(session)).toBeNull();
	});

	it("treats missing markers as unseen", () => {
		const session = chatSession({ lastSeenAt: null });

		expect(isChatSessionUnread(session)).toBe(true);
	});

	it("resolves selected unread sessions to a read-marker update", () => {
		const unread = chatSession({
			id: "session-1",
			updatedAt: "2026-05-20T00:02:00.000Z",
			lastSeenAt: "2026-05-20T00:01:00.000Z",
		});
		const read = chatSession({
			id: "session-2",
			updatedAt: "2026-05-20T00:03:00.000Z",
			lastSeenAt: "2026-05-20T00:03:00.000Z",
		});

		expect(
			resolveSelectedChatSessionSeenUpdate([unread, read], unread.id),
		).toEqual({
			requestKey: "session-1:2026-05-20T00:02:00.000Z",
			sessionId: "session-1",
			update: { lastSeenAt: "2026-05-20T00:02:00.000Z" },
		});
	});

	it("skips selected sessions that are already read or missing", () => {
		const read = chatSession({
			updatedAt: "2026-05-20T00:02:00.000Z",
			lastSeenAt: "2026-05-20T00:02:00.000Z",
		});

		expect(resolveSelectedChatSessionSeenUpdate([read], read.id)).toBeNull();
		expect(
			resolveSelectedChatSessionSeenUpdate([read], "missing-session"),
		).toBeNull();
	});
});

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
		createdAt: "2026-05-20T00:00:00.000Z",
		updatedAt: "2026-05-20T00:00:00.000Z",
		lastSeenAt: "2026-05-20T00:00:00.000Z",
		...overrides,
	};
}
