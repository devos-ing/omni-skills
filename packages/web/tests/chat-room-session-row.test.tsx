import { describe, expect, it } from "bun:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { ChatRoomSessionRow } from "../src/components/chat-room/chat-room-session-row";
import type { ChatSessionRecord } from "../src/lib/api";

describe("chat room session row", () => {
	it("opens archive through a confirmation dialog trigger", () => {
		const html = renderSessionRow();

		expect(html).toContain('aria-label="Archive Focus chat"');
		expect(html).toContain('aria-haspopup="dialog"');
		expect(html).toContain('aria-expanded="false"');
		expect(html).toContain('data-state="closed"');
		expect(textContent(html)).not.toContain("Archive session?");
	});
});

function renderSessionRow(): string {
	return renderToStaticMarkup(
		createElement(ChatRoomSessionRow, {
			activeSessionId: "",
			isPinned: false,
			session: chatSession(),
			onArchiveSession: () => undefined,
			onPinSession: () => undefined,
			onSelectSession: () => undefined,
			onUnpinSession: () => undefined,
		}),
	);
}

function textContent(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

function chatSession(
	overrides: Partial<ChatSessionRecord> = {},
): ChatSessionRecord {
	return {
		id: "session-1",
		workspaceId: "owner-1",
		projectId: "default",
		taskId: "task-1",
		title: "Focus chat",
		pendingRequest: null,
		pendingQuestions: [],
		archived: false,
		createdAt: "2026-05-20T00:00:00.000Z",
		updatedAt: "2026-05-20T00:00:00.000Z",
		...overrides,
	};
}
