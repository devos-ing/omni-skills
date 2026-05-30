import { describe, expect, it } from "bun:test";

import { areOperatorChatSidebarPropsEqual } from "../src/components/web-shell/operator-chat-sidebar-render-utils";
import type { OperatorChatSidebarProps } from "../src/components/web-shell/types/operator-chat-sidebar.types";

describe("operator chat sidebar render utilities", () => {
	it("treats ordinary page navigation props as equal", () => {
		const onCloseMobileSidebar = (): void => {};
		const onSearch = (): void => {};
		const previous = buildProps({ onCloseMobileSidebar, onSearch });
		const next = buildProps({ onCloseMobileSidebar, onSearch });

		expect(areOperatorChatSidebarPropsEqual(previous, next)).toBe(true);
	});

	it("rerenders when the active chat session changes", () => {
		const previous = buildProps({ activeSessionId: "session-1" });
		const next = buildProps({ activeSessionId: "session-2" });

		expect(areOperatorChatSidebarPropsEqual(previous, next)).toBe(false);
	});
});

function buildProps(
	overrides: Partial<OperatorChatSidebarProps> = {},
): OperatorChatSidebarProps {
	return {
		activeSessionId: "",
		isMobileOpen: false,
		onCloseMobileSidebar: (): void => {},
		onSearch: (): void => {},
		...overrides,
	};
}
