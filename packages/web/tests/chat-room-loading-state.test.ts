import { describe, expect, it } from "bun:test";
import {
	shouldShowChatRoomLoadingShell,
	shouldShowMissionProgressSkeleton,
} from "../src/components/chat-room/chat-room-loading-state";

describe("chat room loading state", () => {
	it("shows the loading shell only while a selected chat session is loading", () => {
		expect(
			shouldShowChatRoomLoadingShell({
				hasSelectedSession: true,
				isMessagesLoading: true,
			}),
		).toBe(true);

		expect(
			shouldShowChatRoomLoadingShell({
				hasSelectedSession: false,
				isMessagesLoading: true,
			}),
		).toBe(false);

		expect(
			shouldShowChatRoomLoadingShell({
				hasSelectedSession: true,
				isMessagesLoading: false,
			}),
		).toBe(false);
		expect(
			shouldShowChatRoomLoadingShell({
				hasSelectedSession: true,
				isMessagesLoading: false,
				isRealtimeActive: true,
			}),
		).toBe(true);
		expect(
			shouldShowChatRoomLoadingShell({
				hasSelectedSession: false,
				isMessagesLoading: false,
				isRealtimeActive: true,
			}),
		).toBe(false);
	});

	it("shows the mission skeleton only when a loading chat has an active task", () => {
		expect(
			shouldShowMissionProgressSkeleton({
				hasActiveTask: true,
				isChatRoomLoading: true,
			}),
		).toBe(true);

		expect(
			shouldShowMissionProgressSkeleton({
				hasActiveTask: false,
				isChatRoomLoading: true,
			}),
		).toBe(false);

		expect(
			shouldShowMissionProgressSkeleton({
				hasActiveTask: true,
				isChatRoomLoading: false,
			}),
		).toBe(false);
	});
});
