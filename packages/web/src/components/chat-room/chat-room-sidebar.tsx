"use client";

import { MessageSquarePlus, Search, Settings, X } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";
import { ChatRoomSessionList } from "./chat-room-session-list";
import { ChatRoomSettingsSidebar } from "./chat-room-settings-sidebar";
import { buildChatSessionSidebarContent } from "./chat-room-sidebar-utils";
import type { ChatRoomSidebarProps } from "./types/chat-room-sidebar.types";
import type { ChatRoomSidebarView } from "./types/chat-room.types";

export function ChatRoomSidebar({
	activeSessionId,
	error,
	isCreating,
	isLoading,
	projects,
	sessions,
	onNewSession,
	onArchiveSession,
	onCloseSidebar,
	onSearch,
	onSelectSession,
}: ChatRoomSidebarProps): ReactElement {
	const [sidebarView, setSidebarView] = useState<ChatRoomSidebarView>("main");
	const [collapsedProjectIds, setCollapsedProjectIds] = useState<Set<string>>(
		() => new Set(),
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

	function showMainSidebar(): void {
		setSidebarView("main");
	}

	function showSettingsSidebar(): void {
		setSidebarView("settings");
	}

	function handleCloseSidebar(): void {
		showMainSidebar();
		onCloseSidebar();
	}

	function handleSettingsNavigate(): void {
		showMainSidebar();
		onCloseSidebar();
	}

	function toggleProjectGroup(
		groupId: string,
		isActive: boolean,
		firstSessionId: string,
	): void {
		setCollapsedProjectIds((current) => {
			const next = new Set(current);
			if (!isActive || next.has(groupId)) {
				next.delete(groupId);
				return next;
			}
			next.add(groupId);
			return next;
		});
		if (firstSessionId !== activeSessionId) {
			onSelectSession(firstSessionId);
		}
	}

	return (
		<aside
			aria-label="Projects and sessions"
			className="fixed inset-y-0 left-0 z-40 grid min-h-0 w-[18rem] max-w-[calc(100vw-2rem)] -translate-x-full border-r border-border bg-surface-panel transition-transform peer-checked:translate-x-0 md:static md:z-auto md:max-w-none md:translate-x-0"
		>
			<div className="relative h-full min-h-0 overflow-hidden">
				<div
					aria-hidden={isSettingsView}
					className={cn(
						"absolute inset-0 grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)_auto] transition-transform duration-200 ease-out",
						isSettingsView
							? "pointer-events-none translate-x-full"
							: "translate-x-0",
					)}
					inert={isSettingsView ? true : undefined}
				>
					<div className="grid gap-2 p-3">
						<div className="flex min-w-0 gap-2">
							<Button
								className="min-w-0 flex-1 justify-start border-transparent bg-transparent text-zinc-300 hover:bg-surface-active"
								disabled={isCreating}
								onClick={onNewSession}
								size="sm"
								type="button"
								variant="outline"
							>
								<MessageSquarePlus size={16} />
								New Session
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
							className="w-full justify-start border-transparent bg-transparent text-zinc-300 hover:bg-surface-active"
							onClick={onSearch}
							size="sm"
							type="button"
							variant="outline"
						>
							<Search size={16} />
							Search
						</Button>
					</div>
					<ChatRoomSessionList
						activeSessionId={activeSessionId}
						collapsedProjectIds={collapsedProjectIds}
						error={error}
						isLoading={isLoading}
						pinnedSessions={pinnedSessions}
						projectGroups={projectGroups}
						onArchiveSession={onArchiveSession}
						onPinSession={pinSession}
						onSelectSession={onSelectSession}
						onToggleProjectGroup={toggleProjectGroup}
						onUnpinSession={unpinSession}
					/>
					<nav className="border-t border-border p-3">
						<Button
							className="h-9 w-full justify-start gap-2 px-2 text-xs text-zinc-400 hover:bg-surface-hover hover:text-zinc-200"
							onClick={showSettingsSidebar}
							size="sm"
							type="button"
							variant="ghost"
						>
							<Settings size={15} />
							<Typography
								as="span"
								className="min-w-0 flex-1 truncate text-left"
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
