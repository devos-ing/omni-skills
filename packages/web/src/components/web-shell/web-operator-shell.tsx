"use client";

import { PanelLeft } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import {
	type ReactElement,
	type ReactNode,
	useCallback,
	useMemo,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import type {
	SidebarNavItem,
	SidebarNavKey,
} from "@/components/web-shell/types/web-shell.types";
import { useBoardTasksQuery, useCommandHistoryQuery } from "@/lib/api/queries";

import { CommandSearchDialog } from "./command-search-dialog";
import { OperatorChatSidebar } from "./operator-chat-sidebar";
import {
	activeChatSessionIdFromPathname,
	isChatSurfacePathname,
} from "./operator-chat-sidebar-route";
import { OperatorIssueActionsProvider } from "./operator-issue-actions-context";
import type {
	CommandDraftRequest,
	OperatorIssueActionsContextValue,
} from "./types/operator-issue-actions.types";
import { WebOperatorLayout } from "./web-operator-layout";
import { hrefForNavKey, navItems } from "./web-shell.constants";

function getActiveNavKey(pathname: string): SidebarNavKey {
	return (
		navItems.find(
			(item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
		)?.key ?? "chat"
	);
}

export function WebOperatorShell({
	children,
}: {
	children: ReactNode;
}): ReactElement {
	const pathname = usePathname();
	const router = useRouter();
	const [commandDraftRequest, setCommandDraftRequest] =
		useState<CommandDraftRequest | null>(null);
	const [isChatSidebarMobileOpen, setIsChatSidebarMobileOpen] = useState(false);
	const [isSearchOpen, setIsSearchOpen] = useState(false);
	const searchTasksQuery = useBoardTasksQuery({
		enabled: isSearchOpen,
		refetchIntervalMs: false,
	});
	const commandHistoryQuery = useCommandHistoryQuery({
		enabled: isSearchOpen,
		refetchIntervalMs: false,
	});
	const activeNavKey = getActiveNavKey(pathname);
	const isChatSurface = isChatSurfacePathname(pathname);
	const activeSessionId = activeChatSessionIdFromPathname(pathname);

	const openSearch = useCallback(() => {
		setIsSearchOpen(true);
	}, []);

	const openChatSidebar = useCallback(() => {
		setIsChatSidebarMobileOpen(true);
	}, []);

	const closeChatSidebar = useCallback(() => {
		setIsChatSidebarMobileOpen(false);
	}, []);

	const selectChatCommandDraft = useCallback(
		(draft: string) => {
			router.push("/chat");
			setCommandDraftRequest((current) => ({
				id: (current?.id ?? 0) + 1,
				draft,
			}));
		},
		[router],
	);

	const openIssue = useCallback(
		(taskId: string) => {
			router.push(`/issues/${encodeURIComponent(taskId)}`);
		},
		[router],
	);

	const navigateToSection = useCallback(
		(key: SidebarNavItem["key"]) => {
			router.push(hrefForNavKey(key));
		},
		[router],
	);

	const issueActionsValue = useMemo<OperatorIssueActionsContextValue>(
		() => ({
			commandDraftRequest,
			requestOpenChatSidebar: openChatSidebar,
			requestChatCommandDraft: selectChatCommandDraft,
			requestOpenIssue: openIssue,
			requestSearch: openSearch,
		}),
		[
			commandDraftRequest,
			openChatSidebar,
			openIssue,
			openSearch,
			selectChatCommandDraft,
		],
	);

	return (
		<WebOperatorLayout
			mobileSidebarTrigger={
				!isChatSurface ? (
					<Button
						aria-label="Open chat sidebar"
						className="absolute left-4 top-4 z-20 cursor-pointer md:hidden"
						onClick={openChatSidebar}
						size="icon"
						type="button"
						variant="ghost"
					>
						<PanelLeft size={17} />
					</Button>
				) : null
			}
			overlays={
				<CommandSearchDialog
					activeKey={activeNavKey}
					boardError={searchTasksQuery.error}
					commandHistory={commandHistoryQuery.data}
					commandHistoryError={commandHistoryQuery.error}
					isBoardLoading={searchTasksQuery.isLoading}
					isCommandHistoryLoading={commandHistoryQuery.isLoading}
					isOpen={isSearchOpen}
					navItems={navItems}
					onClose={() => setIsSearchOpen(false)}
					onNavigate={navigateToSection}
					onOpenIssue={openIssue}
					onSelectCommand={selectChatCommandDraft}
					tasks={searchTasksQuery.data}
				/>
			}
			sidebar={
				<OperatorChatSidebar
					activeSessionId={activeSessionId}
					isMobileOpen={isChatSidebarMobileOpen}
					onCloseMobileSidebar={closeChatSidebar}
					onSearch={openSearch}
				/>
			}
		>
			<OperatorIssueActionsProvider value={issueActionsValue}>
				{children}
			</OperatorIssueActionsProvider>
		</WebOperatorLayout>
	);
}
