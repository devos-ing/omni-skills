"use client";

import { Folder, MessageSquarePlus } from "lucide-react";
import type { ReactElement } from "react";

import type { ChatSessionRecord, WorkspaceProjectRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ChatRoomSidebarProps {
	activeSessionId: string;
	isCreating: boolean;
	projects: WorkspaceProjectRecord[];
	sessions: ChatSessionRecord[];
	onNewSession: () => void;
	onSelectSession: (sessionId: string) => void;
}

export function ChatRoomSidebar({
	activeSessionId,
	isCreating,
	projects,
	sessions,
	onNewSession,
	onSelectSession,
}: ChatRoomSidebarProps): ReactElement {
	return (
		<aside className="grid min-h-0 w-full border-r border-zinc-900 bg-[#15161a] md:w-72">
			<div className="grid min-h-0 grid-rows-[auto_auto_minmax(0,1fr)]">
				<div className="border-b border-zinc-900 p-3">
					<button
						className="issue-tool-button w-full justify-start"
						disabled={isCreating}
						onClick={onNewSession}
						type="button"
					>
						<MessageSquarePlus size={16} />
						New Session
					</button>
				</div>
				<div className="border-b border-zinc-900 p-3">
					<div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-zinc-500">
						<Folder size={14} />
						Projects
					</div>
					<div className="grid gap-1 text-sm text-zinc-300">
						{projects.slice(0, 4).map((project) => (
							<div
								className="truncate rounded-md px-2 py-1.5 text-zinc-400"
								key={project.id}
								title={project.localFolder ?? project.name}
							>
								{project.name}
							</div>
						))}
						{projects.length === 0 ? (
							<div className="rounded-md px-2 py-1.5 text-zinc-600">
								No projects yet
							</div>
						) : null}
					</div>
				</div>
				<div className="min-h-0 overflow-auto p-3">
					<div className="mb-2 text-xs font-medium uppercase text-zinc-500">
						Sessions
					</div>
					<div className="grid gap-1">
						{sessions.map((session) => (
							<button
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
								<span className="block truncate">{session.title}</span>
								<span className="mt-1 block truncate text-xs text-zinc-600">
									{session.taskId ?? session.projectId ?? "No issue"}
								</span>
							</button>
						))}
						{sessions.length === 0 ? (
							<div className="rounded-md border border-dashed border-zinc-800 px-3 py-4 text-sm text-zinc-500">
								No sessions yet
							</div>
						) : null}
					</div>
				</div>
			</div>
		</aside>
	);
}
