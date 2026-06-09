import { describe, expect, it } from "bun:test";

import { resolveChatRoomPanelLayout } from "../src/components/chat-room/chat-room-panel-layout";

describe("chat room panel layout", () => {
	it("keeps task details in the main content slot instead of a right column", () => {
		const layout = resolveChatRoomPanelLayout({
			activeContentMode: "taskDetails",
			hasActiveTask: true,
		});

		expect(layout.contentMode).toBe("taskDetails");
		expect(layout.rootClassName).not.toContain("grid-cols");
		expect(layout.sessionClassName).toContain("grid-rows-[auto_minmax(0,1fr)]");
	});

	it("falls back to messages when task details is requested without a task", () => {
		expect(
			resolveChatRoomPanelLayout({
				activeContentMode: "taskDetails",
				hasActiveTask: false,
			}).contentMode,
		).toBe("messages");
	});

	it("uses the main content slot for action status", () => {
		const layout = resolveChatRoomPanelLayout({
			activeContentMode: "action",
			hasActiveTask: true,
		});

		expect(layout.contentMode).toBe("action");
		expect(layout.rootClassName).not.toContain("grid-cols");
		expect(layout.sessionClassName).toContain("grid-rows-[auto_minmax(0,1fr)]");
	});
});
