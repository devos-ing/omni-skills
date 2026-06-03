"use client";

import { MessageSquarePlus, Search, Settings, X } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { ChatRoomSessionList } from "./chat-room-session-list";
import { ChatRoomSettingsSidebar } from "./chat-room-settings-sidebar";
import { ChatRoomSidebarHeader } from "./chat-room-sidebar-header";
import { buildChatSessionSidebarContent } from "./chat-room-sidebar-utils";
import type { ChatRoomSidebarProps } from "./types/chat-room-sidebar.types";
import type { ChatRoomSidebarView } from "./types/chat-room.types";

export function ChatRoomSidebar({
	activeSessionId,
	error,
	isCollapsed,
	isCreating,
	isLoading,
	isMobileOpen,
	projects,
	runningSessionIds,
	sessions,
	onNewSession,
	onArchiveSession,
	onCloseSidebar,
	onSearch,
	onSelectSession,
	onToggleCollapsed,
}: ChatRoomSidebarProps): ReactElement {
	const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
		() => new Set(),
	);
	const sidebarView = useUiStore((state) => state.chatRoomSidebarView);
	const setSidebarViewState = useUiStore(
		(state) => state.setChatRoomSidebarView,
	);
	const pinnedSessionIds = useUiStore((state) => state.pinnedSessionIds);
	const pinSession = useUiStore((state) => state.pinSession);
	const unpinSession = useUiStore((state) => state.unpinSession);
	const isSettingsView = sidebarView === "settings";
	const { pinnedSessions, projectGroups } = buildChatSessionSidebarContent({
		activeSessionId,
		pinnedSessionIds,
		projects,
		sessions,
	});

	function setSidebarView(view: ChatRoomSidebarView): void {
		if (view !== sidebarView) {
			setSidebarViewState(view);
		}
	}

	function showMainSidebar(): void {
		setSidebarView("main");
	}

	function showSettingsSidebar(): void {
		setSidebarView("settings");
	}

	function handleSettingsClick(): void {
		console.log("sidebarView", sidebarView)
		if (isCollapsed) {
			onToggleCollapsed();
		}
		showSettingsSidebar();
	}

	function handleCloseSidebar(): void {
		showMainSidebar();
		onCloseSidebar();
	}

	function handleSettingsNavigate(): void {
		onCloseSidebar();
	}

	function toggleProjectGroup(
		groupId: string,
		isExpanded: boolean,
		firstSessionId: string,
	): void {
		setCollapsedProjectIds((current) => {
			const next = new Set(current);
			if (isExpanded) {
				next.add(groupId);
				return next;
			}
			next.delete(groupId);
			return next;
		});
		if (
			!isExpanded &&
			firstSessionId.length > 0 &&
			firstSessionId !== activeSessionId
		) {
			onSelectSession(firstSessionId);
		}
	}

	return (
		<aside
			aria-label="Projects and sessions"
			className={cn(
				"fixed inset-y-0 left-0 z-40 grid min-h-0 w-[18rem] max-w-[calc(100vw-2rem)] border-r border-border bg-surface-panel transition-[transform,width] md:static md:z-auto md:max-w-none md:transform-none",
				isMobileOpen ? "transform-none" : "-translate-x-full",
				isCollapsed ? "md:w-[4rem]" : "md:w-[18rem]",
			)}
		>
			<div className="relative h-full min-h-0 overflow-hidden">
				<div
					aria-hidden={isSettingsView}
					className={cn(
						"absolute inset-0 grid h-full min-h-0 grid-rows-[auto_auto_minmax(0,1fr)_auto] transition-transform duration-200 ease-out",
						isSettingsView
							? "pointer-events-none translate-x-full"
							: "translate-x-0",
					)}
					inert={isSettingsView ? true : undefined}
				>
					<ChatRoomSidebarHeader
						isCollapsed={isCollapsed}
						onToggleCollapsed={onToggleCollapsed}
					/>
					<div className="grid gap-2 p-3">
						<div
							className={cn(
								"flex min-w-0 gap-2",
								isCollapsed && "md:justify-center",
							)}
						>
							<Button
								aria-label="New Session"
								className={cn(
									"min-w-0 flex-1 justify-start border-transparent bg-transparent text-zinc-300 hover:bg-surface-active",
									isCollapsed &&
										"md:h-9 md:w-9 md:flex-none md:justify-center md:px-0",
								)}
								disabled={isCreating}
								onClick={onNewSession}
								size="sm"
								type="button"
								variant="outline"
							>
								<MessageSquarePlus size={16} />
								<Typography
									as="span"
									className={cn(isCollapsed && "md:sr-only")}
								>
									New Session
								</Typography>
							</Button>
							<Button
								aria-label="Close chat sidebar"
								className="md:hidden"
								onClick={handleCloseSidebar}
								size="icon"
								type="button"
								variant="ghost"
							>
								<X size={16} />
							</Button>
						</div>
						<Button
							aria-label="Search sessions"
							className={cn(
								"w-full justify-start border-transparent bg-transparent text-zinc-300 hover:bg-surface-active",
								isCollapsed && "md:justify-center md:px-0",
							)}
							onClick={onSearch}
							size="sm"
							type="button"
							variant="outline"
						>
							<Search size={16} />
							<Typography as="span" className={cn(isCollapsed && "md:sr-only")}>
								Search
							</Typography>
						</Button>
					</div>
					<div className={cn("min-h-0", isCollapsed && "md:hidden")}>
						<ChatRoomSessionList
							activeSessionId={activeSessionId}
							collapsedProjectIds={collapsedProjectIds}
							error={error}
							isLoading={isLoading}
							pinnedSessions={pinnedSessions}
							projectGroups={projectGroups}
							runningSessionIds={runningSessionIds}
							onArchiveSession={onArchiveSession}
							onPinSession={pinSession}
							onSelectSession={onSelectSession}
							onToggleProjectGroup={toggleProjectGroup}
							onUnpinSession={unpinSession}
						/>
					</div>
					<nav className="border-t border-border p-3">
						<Button
							aria-label="Settings"
							className={cn(
								"h-9 w-full justify-start gap-2 px-2 text-xs text-zinc-400 hover:bg-surface-hover hover:text-zinc-200",
								isCollapsed && "md:justify-center md:px-0",
							)}
							onClick={handleSettingsClick}
							size="sm"
							type="button"
							variant="ghost"
						>
							<Settings size={15} />
							<Typography
								as="span"
								className={cn(
									"min-w-0 flex-1 truncate text-left",
									isCollapsed && "md:sr-only",
								)}
							>
								Settings
							</Typography>
						</Button>
					</nav>
				</div>
				<ChatRoomSettingsSidebar
					isActive={isSettingsView}
					onBack={showMainSidebar}
					onClose={handleCloseSidebar}
					onNavigate={handleSettingsNavigate}
				/>
			</div>
		</aside>
	);
}
