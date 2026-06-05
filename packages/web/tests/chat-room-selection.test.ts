import { describe, expect, it } from "bun:test";

import { selectChatSession } from "../src/components/chat-room/chat-room-selection";
import type { ChatSessionRecord } from "../src/lib/api";

describe("selectChatSession", () => {
	it("does not auto-select the first session without an active id", () => {
		const session = chatSession({ id: "session-1" });

		expect(selectChatSession([session], "")).toEqual({
			selectedSession: null,
			selectedSessionId: "",
		});
	});

	it("selects the requested active session", () => {
		const firstSession = chatSession({ id: "session-1" });
		const secondSession = chatSession({ id: "session-2" });

		expect(
			selectChatSession([firstSession, secondSession], "session-2"),
		).toEqual({
			selectedSession: secondSession,
			selectedSessionId: "session-2",
		});
	});

	it("clears stale active session ids", () => {
		const session = chatSession({ id: "session-1" });

		expect(selectChatSession([session], "missing-session")).toEqual({
			selectedSession: null,
			selectedSessionId: "",
		});
	});
});

function chatSession(
	overrides: Partial<ChatSessionRecord> = {},
): ChatSessionRecord {
	return {
		id: "session-1",
		workspaceId: "owner-1",
		projectId: "default",
		taskId: null,
		title: "Untitled",
		pendingRequest: null,
		pendingQuestions: [],
		archived: false,
		workflowState: null,
		createdAt: "2026-05-20T00:00:00.000Z",
		updatedAt: "2026-05-20T00:00:00.000Z",
		...overrides,
	};
}
