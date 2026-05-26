"use client";

import { ChevronDown, ChevronRight, Folder } from "lucide-react";
import type { ReactElement } from "react";

import { Skeleton } from "@/components/loading/skeleton";
import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import { ChatRoomSessionRow } from "./chat-room-session-row";
import type { ChatRoomSessionListProps } from "./types/chat-room-sidebar.types";

export function ChatRoomSessionList({
	activeSessionId,
	collapsedProjectIds,
	error,
	isLoading,
	pinnedSessions,
	projectGroups,
	onArchiveSession,
	onPinSession,
	onSelectSession,
	onToggleProjectGroup,
	onUnpinSession,
}: ChatRoomSessionListProps): ReactElement {
	const hasSessions = pinnedSessions.length > 0 || projectGroups.length > 0;

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
							const isExpanded =
								group.isActive && !collapsedProjectIds.has(group.id);
							const GroupIcon = isExpanded ? ChevronDown : ChevronRight;
							return (
								<div className="grid gap-1" key={group.id}>
									<Button
										aria-expanded={isExpanded}
										className={cn(
											"h-9 min-w-0 justify-start gap-2 px-2 text-left text-sm",
											group.isActive
												? "bg-[#111110] text-zinc-100"
												: "text-zinc-400 hover:bg-surface-active hover:text-zinc-200",
										)}
										onClick={() =>
											onToggleProjectGroup(
												group.id,
												group.isActive,
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
									{isExpanded ? (
										<div className="grid gap-1 pl-6">
											{group.sessions.map((session) => (
												<ChatRoomSessionRow
													activeSessionId={activeSessionId}
													isPinned={false}
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
		<output className="grid gap-2" aria-label="Loading sessions">
			{[0, 1, 2, 3, 4].map((item) => (
				<div
					className="grid grid-cols-[minmax(0,1fr)_2rem_2rem] gap-1 rounded-md"
					key={item}
				>
					<div className="grid gap-2 px-2 py-2">
						<Skeleton className="h-4 w-36" />
						<Skeleton className="h-3 w-24" />
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
