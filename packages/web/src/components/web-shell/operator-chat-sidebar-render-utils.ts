import type { OperatorChatSidebarProps } from "./types/operator-chat-sidebar.types";

export function areOperatorChatSidebarPropsEqual(
	previous: OperatorChatSidebarProps,
	next: OperatorChatSidebarProps,
): boolean {
	return (
		previous.activeSessionId === next.activeSessionId &&
		previous.isMobileOpen === next.isMobileOpen &&
		previous.onCloseMobileSidebar === next.onCloseMobileSidebar &&
		previous.onSearch === next.onSearch
	);
}
