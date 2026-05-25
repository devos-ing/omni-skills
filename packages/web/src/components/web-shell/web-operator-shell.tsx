"use client";

import { usePathname, useRouter } from "next/navigation";
import {
	type ReactElement,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useState,
} from "react";

import type {
	SidebarDisplayMode,
	SidebarNavItem,
	SidebarNavKey,
} from "@/components/web-shell/types/web-shell.types";
import { WebSidebar } from "@/components/web-shell/web-sidebar";
import { useBoardTasksQuery, useCommandHistoryQuery } from "@/lib/api/queries";

import { CommandSearchDialog } from "./command-search-dialog";
import { OperatorIssueActionsProvider } from "./operator-issue-actions-context";
import type {
	CommandDraftRequest,
	OperatorIssueActionsContextValue,
} from "./types/operator-issue-actions.types";
import { hrefForNavKey, navItems } from "./web-shell.constants";

const compactSidebarQuery = "(max-width: 900px)";

function normalizeSidebarMode(
	mode: SidebarDisplayMode,
	isCompactViewport: boolean,
): SidebarDisplayMode {
	if (isCompactViewport && mode === "expanded") {
		return "collapsed";
	}
	return mode;
}

function nextSidebarMode(
	mode: SidebarDisplayMode,
	isCompactViewport: boolean,
): SidebarDisplayMode {
	const normalizedMode = normalizeSidebarMode(mode, isCompactViewport);

	if (normalizedMode === "expanded") {
		return "collapsed";
	}
	return "expanded";
}

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
	const [sidebarMode, setSidebarMode] =
		useState<SidebarDisplayMode>("expanded");
	const [isCompactViewport, setIsCompactViewport] = useState<boolean>(false);
	const [commandDraftRequest, setCommandDraftRequest] =
		useState<CommandDraftRequest | null>(null);
	const [createIssueRequest, setCreateIssueRequest] = useState(0);
	const [createSessionRequest, setCreateSessionRequest] = useState(0);
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
	const isChatSurface = activeNavKey === "chat";
	const canShowSidebar = sidebarMode !== "hidden" && !isChatSurface;

	useEffect(() => {
		const mediaQuery = window.matchMedia(compactSidebarQuery);
		const syncViewport = (): void => {
			const isCompact = mediaQuery.matches;
			setIsCompactViewport(isCompact);
			setSidebarMode((current) => normalizeSidebarMode(current, isCompact));
		};
		syncViewport();
		mediaQuery.addEventListener("change", syncViewport);
		return () => {
			mediaQuery.removeEventListener("change", syncViewport);
		};
	}, []);

	const toggleSidebarMode = useCallback(() => {
		setSidebarMode((current) => nextSidebarMode(current, isCompactViewport));
	}, [isCompactViewport]);

	const createIssue = useCallback(() => {
		router.push("/issues");
		setCreateIssueRequest((value) => value + 1);
	}, [router]);

	const createSession = useCallback(() => {
		router.push("/chat");
		setCreateSessionRequest((value) => value + 1);
	}, [router]);

	const openSearch = useCallback(() => {
		setIsSearchOpen(true);
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

	const viewportColumns = useMemo(() => {
		return canShowSidebar ? "auto minmax(0, 1fr)" : "minmax(0, 1fr)";
	}, [canShowSidebar]);
	const issueActionsValue = useMemo<OperatorIssueActionsContextValue>(
		() => ({
			commandDraftRequest,
			createIssueRequest,
			createSessionRequest,
			requestChatCommandDraft: selectChatCommandDraft,
			requestNewIssue: createIssue,
			requestNewSession: createSession,
			requestOpenIssue: openIssue,
			requestSearch: openSearch,
		}),
		[
			commandDraftRequest,
			createIssue,
			createIssueRequest,
			createSession,
			createSessionRequest,
			openIssue,
			openSearch,
			selectChatCommandDraft,
		],
	);

	return (
		<main
			style={{
				height: "100dvh",
				maxHeight: "100dvh",
				display: "grid",
				gridTemplateColumns: viewportColumns,
				background: "#0f1013",
				position: "relative",
				overflowX: "clip",
			}}
		>
			{canShowSidebar ? (
				<WebSidebar
					mode={sidebarMode}
					activeKey={activeNavKey}
					navItems={navItems}
					onNewSession={createSession}
					onSearch={openSearch}
					onToggleMode={toggleSidebarMode}
				/>
			) : null}
			<OperatorIssueActionsProvider value={issueActionsValue}>
				{children}
			</OperatorIssueActionsProvider>
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
				onNewIssue={createIssue}
				onOpenIssue={openIssue}
				onSelectCommand={selectChatCommandDraft}
				tasks={searchTasksQuery.data}
			/>
		</main>
	);
}
