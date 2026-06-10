"use client";

import { useRouter } from "next/navigation";
import {
	type ReactElement,
	memo,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { ChatRoomSidebar } from "@/components/chat-room/chat-room-sidebar";
import { activeChatStreamSessionIds } from "@/components/chat-room/chat-room-stream-utils";
import { resolveSelectedChatSessionSeenUpdate } from "@/components/chat-room/chat-session-read-state";
import {
	useChatSessionsQuery,
	useCreateChatSessionMutation,
	useUpdateChatSessionMutation,
} from "@/lib/api/chat-queries";
import {
	useBoardTasksQuery,
	useCurrentWorkspaceQuery,
} from "@/lib/api/queries";
import { useWorkspaceProjectsQuery } from "@/lib/api/realtime-queries";
import { useRealtimeStore } from "@/lib/realtime";
import { useUiStore } from "@/lib/ui-store";

import { areOperatorChatSidebarPropsEqual } from "./operator-chat-sidebar-render-utils";
import type { OperatorChatSidebarProps } from "./types/operator-chat-sidebar.types";

const NO_REFETCH = { refetchIntervalMs: false } as const;

function OperatorChatSidebarView({
	activeSessionId,
	isMobileOpen,
	onCloseMobileSidebar,
	onSearch,
}: OperatorChatSidebarProps): ReactElement {
	const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] =
		useState(false);
	const router = useRouter();
	const currentWorkspaceQuery = useCurrentWorkspaceQuery(NO_REFETCH);
	const workspaceId = currentWorkspaceQuery.data?.workspaceId ?? "";
	const workspaceName = currentWorkspaceQuery.data?.name ?? null;
	const sessionsQuery = useChatSessionsQuery(workspaceId, NO_REFETCH);
	const tasksQuery = useBoardTasksQuery(NO_REFETCH);
	const projectsQuery = useWorkspaceProjectsQuery(workspaceId, NO_REFETCH);
	const createSession = useCreateChatSessionMutation();
	const updateSession = useUpdateChatSessionMutation();
	const readMarkerRequests = useRef<Set<string>>(new Set());
	const chatStreamsByRunId = useRealtimeStore(
		(state) => state.chatStreamsByRunId,
	);
	const requestMessageInputFocus = useUiStore(
		(state) => state.requestMessageInputFocus,
	);
	const runningSessionIds = activeChatStreamSessionIds(
		chatStreamsByRunId,
		sessionsQuery.data ?? [],
		tasksQuery.data ?? [],
	);
	const activeSession =
		sessionsQuery.data?.find((session) => session.id === activeSessionId) ??
		null;

	const markSessionRead = useCallback(
		(sessionId: string): void => {
			const seenUpdate = resolveSelectedChatSessionSeenUpdate(
				sessionsQuery.data ?? [],
				sessionId,
			);
			if (
				!seenUpdate ||
				readMarkerRequests.current.has(seenUpdate.requestKey)
			) {
				return;
			}
			readMarkerRequests.current.add(seenUpdate.requestKey);
			updateSession.mutate({
				sessionId: seenUpdate.sessionId,
				session: seenUpdate.update,
			});
		},
		[sessionsQuery.data, updateSession],
	);

	useEffect(() => {
		if (!activeSession) {
			return;
		}
		markSessionRead(activeSession.id);
	}, [activeSession, markSessionRead]);

	function closeMobileSidebar(): void {
		onCloseMobileSidebar();
	}

	function toggleSessionSidebar(): void {
		setIsSessionSidebarCollapsed((current) => !current);
	}

	async function startNewSession(): Promise<void> {
		if (!workspaceId) {
			toast.error("Workspace is still loading.");
			return;
		}
		const session = await createSession.mutateAsync({ workspaceId });
		requestMessageInputFocus(session.id);
		router.push(`/session/${encodeURIComponent(session.id)}`);
		closeMobileSidebar();
	}

	async function archiveSession(sessionId: string): Promise<void> {
		try {
			await updateSession.mutateAsync({
				sessionId,
				session: { archived: true },
			});
			if (sessionId === activeSessionId) {
				router.push("/chat");
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Archive failed");
		}
	}

	function search(): void {
		closeMobileSidebar();
		onSearch();
	}

	function selectSession(sessionId: string): void {
		markSessionRead(sessionId);
		router.push(`/session/${encodeURIComponent(sessionId)}`);
		closeMobileSidebar();
	}

	return (
		<>
			{isMobileOpen ? (
				<button
					aria-label="Close chat sidebar"
					className="fixed inset-y-0 left-20 right-0 z-30 bg-black/60 md:hidden"
					onClick={closeMobileSidebar}
					type="button"
				/>
			) : null}
			<ChatRoomSidebar
				activeSessionId={activeSessionId}
				error={sessionsQuery.error}
				isCollapsed={isSessionSidebarCollapsed}
				isCreating={createSession.isPending}
				isLoading={sessionsQuery.isLoading}
				isMobileOpen={isMobileOpen}
				projects={projectsQuery.data ?? []}
				runningSessionIds={runningSessionIds}
				sessions={sessionsQuery.data ?? []}
				workspaceName={workspaceName}
				onArchiveSession={(sessionId) => void archiveSession(sessionId)}
				onCloseSidebar={closeMobileSidebar}
				onNewSession={() => void startNewSession()}
				onSearch={search}
				onSelectSession={selectSession}
				onToggleCollapsed={toggleSessionSidebar}
			/>
		</>
	);
}

export const OperatorChatSidebar = memo(
	OperatorChatSidebarView,
	areOperatorChatSidebarPropsEqual,
);

OperatorChatSidebar.displayName = "OperatorChatSidebar";
