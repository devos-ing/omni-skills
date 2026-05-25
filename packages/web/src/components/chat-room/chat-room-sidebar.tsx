"use client";

import {
	ChevronDown,
	ChevronRight,
	Folder,
	MessageSquarePlus,
	Search,
	Settings,
	X,
} from "lucide-react";
import { type ReactElement, useState } from "react";

import { cn } from "@/lib/utils";
import { ChatRoomSettingsSidebar } from "./chat-room-settings-sidebar";
import { buildChatSessionProjectGroups } from "./chat-room-sidebar-utils";
import type { ChatRoomSidebarProps } from "./types/chat-room-sidebar.types";
import type { ChatRoomSidebarView } from "./types/chat-room.types";

export function ChatRoomSidebar({
	activeSessionId,
	isCreating,
	projects,
	sessions,
	onNewSession,
	onCloseSidebar,
	onSearch,
	onSelectSession,
}: ChatRoomSidebarProps): ReactElement {
	const [sidebarView, setSidebarView] = useState<ChatRoomSidebarView>("main");
	const isSettingsView = sidebarView === "settings";
	const sessionGroups = buildChatSessionProjectGroups({
		activeSessionId,
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

	return (
		<aside
			aria-label="Projects and sessions"
			className="fixed inset-y-0 left-0 z-40 grid min-h-0 w-[18rem] max-w-[calc(100vw-2rem)] -translate-x-full border-r border-zinc-900 bg-[#15161a] shadow-2xl transition-transform peer-checked:translate-x-0 md:static md:z-auto md:max-w-none md:translate-x-0 md:shadow-none"
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
					<div className="grid gap-2 border-b border-zinc-900 p-3">
						<div className="flex min-w-0 gap-2">
							<button
								className="issue-tool-button min-w-0 flex-1 justify-start"
								disabled={isCreating}
								onClick={onNewSession}
								type="button"
							>
								<MessageSquarePlus size={16} />
								New Session
							</button>
							<button
								aria-label="Close chat sidebar"
								className="issue-icon-button md:hidden"
								onClick={handleCloseSidebar}
								type="button"
							>
								<X size={16} />
							</button>
						</div>
						<button
							className="issue-tool-button w-full justify-start"
							onClick={onSearch}
							type="button"
						>
							<Search size={16} />
							Search
						</button>
					</div>
					<div className="min-h-0 overflow-auto p-3">
						<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-zinc-500">
							<Folder size={14} />
							Sessions
						</div>
						<div className="grid gap-1">
							{sessionGroups.map((group) => {
								const firstSessionId = group.sessions[0]?.id;
								const GroupIcon = group.isActive ? ChevronDown : ChevronRight;
								return (
									<div className="grid gap-1" key={group.id}>
										<button
											aria-expanded={group.isActive}
											className={cn(
												"flex h-9 min-w-0 items-center gap-2 rounded-md px-2 text-left text-sm",
												group.isActive
													? "bg-zinc-900 text-zinc-100"
													: "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
											)}
											onClick={() => {
												if (!group.isActive && firstSessionId) {
													onSelectSession(firstSessionId);
												}
											}}
											title={group.label}
											type="button"
										>
											<GroupIcon className="shrink-0" size={14} />
											<Folder className="shrink-0" size={14} />
											<span className="min-w-0 flex-1 truncate">
												{group.label}
											</span>
											<span className="shrink-0 rounded bg-zinc-800 px-1.5 py-0.5 text-[11px] leading-none text-zinc-500">
												{group.sessions.length}
											</span>
										</button>
										{group.isActive ? (
											<div className="grid gap-1 pl-6">
												{group.sessions.map((session) => (
													<button
														aria-current={
															session.id === activeSessionId
																? "page"
																: undefined
														}
														className={cn(
															"min-w-0 rounded-md px-2 py-2 text-left text-sm",
															session.id === activeSessionId
																? "bg-zinc-800 text-zinc-100"
																: "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200",
														)}
														key={session.id}
														onClick={() => onSelectSession(session.id)}
														type="button"
													>
														<span className="block truncate">
															{session.title}
														</span>
														<span className="mt-1 block truncate text-xs text-zinc-600">
															{session.taskId ?? "No issue"}
														</span>
													</button>
												))}
											</div>
										) : null}
									</div>
								);
							})}
							{sessions.length === 0 ? (
								<div className="rounded-md border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
									No sessions yet
								</div>
							) : null}
						</div>
					</div>
					<nav className="border-t border-zinc-900 p-3">
						<button
							className="flex h-9 w-full items-center gap-2 rounded-md px-2 text-xs text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
							onClick={showSettingsSidebar}
							type="button"
						>
							<Settings size={15} />
							<span className="min-w-0 flex-1 truncate text-left">
								Settings
							</span>
						</button>
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
