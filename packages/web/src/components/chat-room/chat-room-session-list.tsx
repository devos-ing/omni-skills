"use client";

import { ChevronDown, ChevronRight, ChevronUp, Folder } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Skeleton } from "@/components/loading/skeleton";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { ChatRoomSessionRow } from "./chat-room-session-row";
import { buildVisibleProjectSessions } from "./chat-room-sidebar-utils";
import type { ChatRoomSessionListProps } from "./types/chat-room-sidebar.types";

export function ChatRoomSessionList({
	activeSessionId,
	collapsedProjectIds,
	error,
	isLoading,
	pinnedSessions,
	projectGroups,
	runningSessionIds,
	onArchiveSession,
	onPinSession,
	onSelectSession,
	onToggleProjectGroup,
	onUnpinSession,
}: ChatRoomSessionListProps): ReactElement {
	const [expandedSessionListIds, setExpandedSessionListIds] = useState<
		Set<string>
	>(() => new Set());
	const hasSessions = pinnedSessions.length > 0 || projectGroups.length > 0;

	function toggleSessionList(groupId: string): void {
		setExpandedSessionListIds((current) => {
			const next = new Set(current);
			if (next.has(groupId)) {
				next.delete(groupId);
				return next;
			}
			next.add(groupId);
			return next;
		});
	}

	return (
		<div className="min-h-0 overflow-auto p-3">
			<div className="mb-2 flex items-center gap-2 text-xs font-medium text-muted-foreground">
				<Folder size={14} />
				<Typography as="span" variant="eyebrow">
					Sessions
				</Typography>
			</div>
			<div className="grid gap-1">
				{isLoading ? <ChatSessionListSkeleton /> : null}
				{!isLoading && error ? <ChatSessionListError error={error} /> : null}
				{!isLoading && !error ? (
					<>
						{pinnedSessions.length > 0 ? (
							<div className="mb-2 grid gap-1 border-b border-border pb-2">
								{pinnedSessions.map((session) => (
									<ChatRoomSessionRow
										activeSessionId={activeSessionId}
										isPinned={true}
										isRunning={runningSessionIds.has(session.id)}
										key={session.id}
										onArchiveSession={onArchiveSession}
										onPinSession={onPinSession}
										onSelectSession={onSelectSession}
										onUnpinSession={onUnpinSession}
										session={session}
									/>
								))}
							</div>
						) : null}
						{projectGroups.map((group) => {
							const firstSessionId = group.sessions[0]?.id ?? "";
							const isProjectExpanded = !collapsedProjectIds.has(group.id);
							const isSessionListExpanded = expandedSessionListIds.has(
								group.id,
							);
							const GroupIcon = isProjectExpanded ? ChevronDown : ChevronRight;
							const visibleSessions = buildVisibleProjectSessions({
								isExpanded: isSessionListExpanded,
								sessions: group.sessions,
							});
							const SessionListIcon = isSessionListExpanded
								? ChevronUp
								: ChevronDown;
							return (
								<div className="grid gap-1" key={group.id}>
									<Button
										aria-expanded={isProjectExpanded}
										className={cn(
											"h-9 min-w-0 justify-start gap-2 px-2 text-left text-sm",
											group.isActive
												? "bg-[#111110] text-zinc-100"
												: "text-zinc-400 hover:bg-surface-active hover:text-zinc-200",
										)}
										onClick={() =>
											onToggleProjectGroup(
												group.id,
												isProjectExpanded,
												firstSessionId,
											)
										}
										size="sm"
										title={group.label}
										type="button"
										variant="ghost"
									>
										<GroupIcon className="shrink-0" size={14} />
										<Folder className="shrink-0" size={14} />
										<Typography as="span" className="min-w-0 flex-1 truncate">
											{group.label}
										</Typography>
										<Typography
											className="shrink-0 rounded bg-surface-active px-1.5 py-0.5 text-[11px] leading-none"
											variant="muted"
										>
											{group.sessions.length}
										</Typography>
									</Button>
									{isProjectExpanded ? (
										<div className="grid gap-1 pl-6">
											{visibleSessions.sessions.map((session) => (
												<ChatRoomSessionRow
													activeSessionId={activeSessionId}
													isPinned={false}
													isRunning={runningSessionIds.has(session.id)}
													key={session.id}
													onArchiveSession={onArchiveSession}
													onPinSession={onPinSession}
													onSelectSession={onSelectSession}
													onUnpinSession={onUnpinSession}
													session={session}
												/>
											))}
											{/* {visibleSessions.hasOverflow ? (
												<Button
													aria-expanded={isSessionListExpanded}
													aria-label={
														isSessionListExpanded
															? `Show fewer ${group.label} sessions`
															: `Show ${visibleSessions.hiddenSessionCount} more ${group.label} sessions`
													}
													className="h-8 min-w-0 justify-start gap-2 px-2 text-xs text-zinc-400 hover:bg-surface-active hover:text-zinc-200"
													onClick={() => toggleSessionList(group.id)}
													size="sm"
													title={
														isSessionListExpanded
															? "Show fewer sessions"
															: `Show ${visibleSessions.hiddenSessionCount} more sessions`
													}
													type="button"
													variant="ghost"
												>
													<SessionListIcon className="shrink-0" size={14} />
													<Typography
														as="span"
														className="min-w-0 flex-1 truncate text-left"
													>
														{isSessionListExpanded
															? "Show fewer"
															: `Show ${visibleSessions.hiddenSessionCount} more`}
													</Typography>
												</Button>
											) : null} */}
										</div>
									) : null}
								</div>
							);
						})}
						{!hasSessions ? (
							<div className="rounded-md border border-dashed border-border px-3 py-4 text-sm text-muted-foreground">
								<Typography variant="description">No sessions yet</Typography>
							</div>
						) : null}
					</>
				) : null}
			</div>
		</div>
	);
}

function ChatSessionListSkeleton(): ReactElement {
	return (
		<output className="grid gap-1" aria-label="Loading sessions">
			{[0, 1, 2, 3, 4].map((item) => (
				<div
					className="grid min-h-9 grid-cols-[minmax(0,1fr)_2rem_2rem] items-center gap-1 rounded-md"
					key={item}
				>
					<div className="px-2 py-2">
						<Skeleton className="h-4 w-32 max-w-full" />
					</div>
					<Skeleton className="h-8 w-8" />
					<Skeleton className="h-8 w-8" />
				</div>
			))}
		</output>
	);
}

function ChatSessionListError({ error }: { error: Error }): ReactElement {
	return (
		<div className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-3">
			<Typography variant="error">{error.message}</Typography>
		</div>
	);
}
