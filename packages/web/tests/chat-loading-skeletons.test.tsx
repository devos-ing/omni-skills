import { describe, expect, it } from "bun:test";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ChatRoomSessionList } from "../src/components/chat-room/chat-room-session-list";
import { ChatTranscript } from "../src/components/chat-room/chat-transcript";
import type {
	ChatMessageRecord,
	ChatSessionRecord,
} from "../src/lib/api/types/chat.types";

describe("chat loading skeletons", () => {
	it("shows session skeleton rows only while the session list is loading", () => {
		const loadingHtml = renderSessionList({
			error: new Error("Sessions failed"),
			isLoading: true,
			pinnedSessions: [chatSession({ title: "Pinned session" })],
			projectGroups: [
				{
					id: "default",
					isActive: true,
					label: "Default",
					sessions: [chatSession({ id: "session-2", title: "Loaded chat" })],
				},
			],
		});

		expect(loadingHtml).toContain('aria-label="Loading sessions"');
		expect(loadingHtml).toContain("animate-pulse");
		expect(textContent(loadingHtml)).not.toContain("Pinned session");
		expect(textContent(loadingHtml)).not.toContain("Loaded chat");
		expect(textContent(loadingHtml)).not.toContain("Sessions failed");

		const loadedHtml = renderSessionList({
			isLoading: false,
			projectGroups: [
				{
					id: "default",
					isActive: true,
					label: "Default",
					sessions: [chatSession({ title: "Loaded chat" })],
				},
			],
		});
		expect(loadedHtml).not.toContain('aria-label="Loading sessions"');
		expect(textContent(loadedHtml)).toContain("Loaded chat");

		const emptyHtml = renderSessionList({ isLoading: false });
		expect(textContent(emptyHtml)).toContain("No sessions yet");

		const errorHtml = renderSessionList({
			error: new Error("Sessions failed"),
			isLoading: false,
		});
		expect(textContent(errorHtml)).toContain("Sessions failed");
		expect(textContent(errorHtml)).not.toContain("No sessions yet");
	});

	it("shows message-shaped skeletons only while chat history is loading", () => {
		const loadingHtml = renderTranscript({
			isLoading: true,
			messages: [],
		});
		expect(loadingHtml).toContain('aria-label="Loading conversation"');
		expect(loadingHtml).toContain("justify-self-start");
		expect(loadingHtml).toContain("justify-self-end");
		expect(textContent(loadingHtml)).not.toContain("Welcome, roy");

		const loadedHtml = renderTranscript({
			isLoading: false,
			messages: [chatMessage({ content: "Loaded conversation" })],
		});
		expect(loadedHtml).not.toContain('aria-label="Loading conversation"');
		expect(textContent(loadedHtml)).toContain("Loaded conversation");

		const emptyHtml = renderTranscript({ isLoading: false, messages: [] });
		expect(textContent(emptyHtml)).toContain("Welcome, roy");

		const errorHtml = renderTranscript({
			error: new Error("History failed"),
			isLoading: false,
			messages: [],
		});
		expect(textContent(errorHtml)).toContain("History failed");
		expect(errorHtml).not.toContain('aria-label="Loading conversation"');
	});
});

function renderSessionList({
	error = null,
	isLoading,
	pinnedSessions = [],
	projectGroups = [],
}: {
	error?: Error | null;
	isLoading: boolean;
	pinnedSessions?: ChatSessionRecord[];
	projectGroups?: Array<{
		id: string;
		label: string;
		isActive: boolean;
		sessions: ChatSessionRecord[];
	}>;
}): string {
	return renderToStaticMarkup(
		createElement(ChatRoomSessionList, {
			activeSessionId: "session-1",
			collapsedProjectIds: new Set<string>(),
			error,
			isLoading,
			pinnedSessions,
			projectGroups,
			onArchiveSession: () => undefined,
			onPinSession: () => undefined,
			onSelectSession: () => undefined,
			onToggleProjectGroup: () => undefined,
			onUnpinSession: () => undefined,
		}),
	);
}

function renderTranscript({
	error = null,
	isLoading,
	messages,
}: {
	error?: Error | null;
	isLoading: boolean;
	messages: ChatMessageRecord[];
}): string {
	const queryClient = new QueryClient();
	return renderToStaticMarkup(
		createElement(
			QueryClientProvider,
			{ client: queryClient },
			createElement(ChatTranscript, {
				error,
				isLoading,
				isThinking: false,
				missionProgress: null,
				messages,
				session: chatSession(),
				streamLines: [],
				workingStartedAt: null,
				onDraftCommand: () => undefined,
			}),
		),
	);
}

function textContent(html: string): string {
	return html.replace(/<[^>]*>/g, "");
}

function chatMessage(
	overrides: Partial<ChatMessageRecord> = {},
): ChatMessageRecord {
	return {
		id: "message-1",
		sessionId: "session-1",
		role: "assistant",
		kind: "message",
		content: "Message",
		taskId: null,
		commandAction: null,
		metadata: null,
		createdAt: "2026-05-20T00:00:00.000Z",
		...overrides,
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
		createdAt: "2026-05-20T00:00:00.000Z",
		updatedAt: "2026-05-20T00:00:00.000Z",
		...overrides,
	};
}
