import { describe, expect, it } from "bun:test";

import { resolveChatRoomSidebarWorkspaceName } from "../src/components/chat-room/chat-room-sidebar-header-utils";

describe("chat room sidebar header", () => {
	it("uses the current workspace name when available", () => {
		expect(resolveChatRoomSidebarWorkspaceName("T-Rex")).toBe("T-Rex");
	});

	it("falls back to Workspace for blank names", () => {
		expect(resolveChatRoomSidebarWorkspaceName("   ")).toBe("Workspace");
	});
});
