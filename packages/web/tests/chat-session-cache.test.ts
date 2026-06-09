import { describe, expect, it } from "bun:test";
import { isChatSessionUnread } from "../src/components/chat-room/chat-session-read-state";
import { mergeChatSessions } from "../src/lib/api/chat-session-cache";
import type { ChatSessionRecord } from "../src/lib/api/types/chat.types";

describe("chat session cache", () => {
	it("keeps newer session updates when older read-marker responses arrive", () => {
		const seenAtT1 = chatSession({
			updatedAt: "2026-05-16T00:01:00.000Z",
			lastSeenAt: "2026-05-16T00:01:00.000Z",
		});
		const updatedAtT2 = chatSession({
			updatedAt: "2026-05-16T00:02:00.000Z",
			lastSeenAt: "2026-05-16T00:01:00.000Z",
		});
		const seenAtT2 = chatSession({
			updatedAt: "2026-05-16T00:02:00.000Z",
			lastSeenAt: "2026-05-16T00:02:00.000Z",
		});

		const preserved = mergeChatSessions([updatedAtT2], [seenAtT1]);

		expect(preserved).toEqual([updatedAtT2]);
		expect(isChatSessionUnread(preserved[0] ?? seenAtT1)).toBe(true);
		expect(mergeChatSessions(preserved, [seenAtT2])).toEqual([seenAtT2]);
	});

	it("does not regress the read marker for equal session updates", () => {
		const seenAtT2 = chatSession({
			updatedAt: "2026-05-16T00:02:00.000Z",
			lastSeenAt: "2026-05-16T00:02:00.000Z",
		});
		const delayedUnreadAtT2 = chatSession({
			updatedAt: "2026-05-16T00:02:00.000Z",
			lastSeenAt: "2026-05-16T00:01:00.000Z",
		});

		const preserved = mergeChatSessions([seenAtT2], [delayedUnreadAtT2]);

		expect(preserved).toEqual([seenAtT2]);
		expect(isChatSessionUnread(preserved[0] ?? delayedUnreadAtT2)).toBe(false);
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
		createdAt: "2026-05-16T00:00:00.000Z",
		updatedAt: "2026-05-16T00:00:00.000Z",
		lastSeenAt: "2026-05-16T00:00:00.000Z",
		...overrides,
	};
}
