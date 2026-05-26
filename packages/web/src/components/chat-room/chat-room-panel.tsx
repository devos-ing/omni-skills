"use client";

import { useRouter } from "next/navigation";
import { type ReactElement, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import {
	useAppendChatMessageMutation,
	useChatMessagesQuery,
	useChatSessionsQuery,
	useCreateChatSessionMutation,
	useSendChatMessageMutation,
	useUpdateChatSessionMutation,
} from "@/lib/api/chat-queries";
import { useCurrentWorkspaceQuery } from "@/lib/api/queries";
import { useWorkspaceProjectsQuery } from "@/lib/api/realtime-queries";
import { useRealtimeStore } from "@/lib/realtime";

import { useChatClarificationState } from "./chat-clarification-state";
import { createChatClarificationSubmitters } from "./chat-clarification-submitters";
import { parseChatCommand } from "./chat-command-utils";
import { executeCommandInput } from "./chat-room-command-actions";
import { useChatRoomMission } from "./chat-room-mission";
import { useChatRoomDraftState } from "./chat-room-panel-draft-state";
import { ChatRoomPanelView } from "./chat-room-panel-view";
import { selectChatSession } from "./chat-room-selection";
import { chatStreamLinesForSession } from "./chat-room-stream-utils";
import { shouldShowChatThinkingIndicator } from "./chat-thinking-state";
import { useWorkingSectionState } from "./chat-working-section-state";
import type * as CRT from "./types/chat-room.types";
import { useChatTaskDetailPanelState } from "./use-chat-task-detail-panel-state";

const SIDEBAR_CONTROL_ID = "chat-sidebar-toggle";
const NO_REFETCH = { refetchIntervalMs: false } as const;

export function ChatRoomPanel({
	commandDraftRequest,
	initialSessionId = "",
	newSessionRequest,
	onSearchRequest,
}: CRT.ChatRoomPanelProps): ReactElement {
	const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
	const [draft, setDraft] = useState("");
	const [commandLines, setCommandLines] = useState<CRT.ChatStreamLine[]>([]);
	const clarificationState = useChatClarificationState();
	const handledNewSessionRequest = useRef(0);
	const sidebarToggleRef = useRef<HTMLInputElement>(null);
	const router = useRouter();
	const { runWithWorkingLabel, workingStartedAt } = useWorkingSectionState();
	const { handleDraftChange, markCommandDraftHandled } = useChatRoomDraftState({
		commandDraftRequest,
		setDraft,
	});

	const currentWorkspaceQuery = useCurrentWorkspaceQuery(NO_REFETCH);
	const workspaceId = currentWorkspaceQuery.data?.workspaceId ?? "";
	const sessionsQuery = useChatSessionsQuery(workspaceId, NO_REFETCH);
	const projectsQuery = useWorkspaceProjectsQuery(workspaceId, NO_REFETCH);
	const createSession = useCreateChatSessionMutation();
	const updateSession = useUpdateChatSessionMutation();
	const appendMessage = useAppendChatMessageMutation();
	const sendMessage = useSendChatMessageMutation();

	const sessions = sessionsQuery.data ?? [];
	const { selectedSession, selectedSessionId } = selectChatSession(
		sessions,
		activeSessionId,
	);
	const messagesQuery = useChatMessagesQuery(selectedSessionId, {
		enabled: Boolean(selectedSessionId),
		refetchIntervalMs: false,
	});
	const messages = messagesQuery.data ?? [];
	const { activeTaskId, missionProgress } = useChatRoomMission(
		selectedSession,
		messages,
	);
	const taskDetails = useChatTaskDetailPanelState({
		activeTaskId,
		selectedSessionId,
	});
	const { pendingAnswers, pendingQuestionIndex } =
		clarificationState.readPending(selectedSessionId);
	const chatStreamsByRunId = useRealtimeStore(
		(state) => state.chatStreamsByRunId,
	);
	const streamLines = [
		...commandLines,
		...chatStreamLinesForSession(chatStreamsByRunId, selectedSessionId),
	];
	const isThinking = shouldShowChatThinkingIndicator({
		isSending: sendMessage.isPending,
		selectedSessionId,
		sendingSessionId: sendMessage.variables?.sessionId,
		streamLineCount: streamLines.length,
	});
	const mutationBusy =
		createSession.isPending ||
		updateSession.isPending ||
		appendMessage.isPending ||
		sendMessage.isPending;
	const isBusy = currentWorkspaceQuery.isLoading || mutationBusy;
	const clarificationSubmitters = createChatClarificationSubmitters({
		clarificationState,
		pendingAnswers,
		pendingQuestionIndex,
		runWithWorkingLabel,
		selectedSession,
		sendMessage: (input) => sendMessage.mutateAsync(input),
	});
	useEffect(() => {
		if (
			newSessionRequest <= 0 ||
			newSessionRequest === handledNewSessionRequest.current ||
			!workspaceId
		) {
			return;
		}
		handledNewSessionRequest.current = newSessionRequest;
		void startNewSession();
	}, [newSessionRequest, workspaceId]);

	async function startNewSession(closeSidebar = false): Promise<void> {
		if (!workspaceId) {
			toast.error("Workspace is still loading.");
			return;
		}
		const session = await createSession.mutateAsync({ workspaceId });
		setActiveSessionId(session.id);
		router.push(`/session/${encodeURIComponent(session.id)}`);
		setDraft("");
		taskDetails.close();
		if (closeSidebar) closeMobileSidebar();
	}

	function closeMobileSidebar(): void {
		if (sidebarToggleRef.current) sidebarToggleRef.current.checked = false;
	}

	async function handleSubmit(): Promise<void> {
		const content = draft.trim();
		if (!content || isBusy) return;
		markCommandDraftHandled();
		setDraft("");
		try {
			await runWithWorkingLabel(async () => {
				if (!selectedSession && !workspaceId) {
					throw new Error("Workspace is still loading.");
				}
				const session =
					selectedSession ?? (await createSession.mutateAsync({ workspaceId }));
				if (!selectedSession) {
					setActiveSessionId(session.id);
					router.push(`/session/${encodeURIComponent(session.id)}`);
				}
				const command = parseChatCommand(content, {
					projectId: session.projectId,
				});
				await executeInput(session.id, content, command);
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Send failed");
		}
	}

	async function executeInput(
		sessionId: string,
		content: string,
		command: ReturnType<typeof parseChatCommand>,
	): Promise<void> {
		if (command.kind === "none") {
			await sendMessage.mutateAsync({ sessionId, message: { content } });
			return;
		}
		await executeCommandInput(
			{
				appendMessage: (input) => appendMessage.mutateAsync(input),
				setStreamLines: setCommandLines,
				startNewSession,
				updateProject: ({ sessionId: targetSessionId, projectId }) =>
					updateSession.mutateAsync({
						sessionId: targetSessionId,
						session: { projectId },
					}),
			},
			sessionId,
			content,
			command,
		);
	}

	async function archiveSession(sessionId: string): Promise<void> {
		try {
			await updateSession.mutateAsync({
				sessionId,
				session: { archived: true },
			});
			if (sessionId === selectedSessionId) {
				setActiveSessionId("");
				router.push("/chat");
				taskDetails.close();
			}
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Archive failed");
		}
	}

	return (
		<ChatRoomPanelView
			activeSessionId={selectedSessionId}
			activeTaskId={activeTaskId}
			draft={draft}
			isBusy={isBusy}
			isCreatingSession={createSession.isPending}
			isMessagesLoading={messagesQuery.isLoading}
			isSessionListLoading={sessionsQuery.isLoading}
			isSending={sendMessage.isPending}
			isTaskDetailPanelOpen={taskDetails.isOpen}
			isThinking={isThinking}
			missionProgress={missionProgress}
			messages={messages}
			messagesError={messagesQuery.error}
			pendingAnswers={pendingAnswers}
			pendingQuestionIndex={pendingQuestionIndex}
			projects={projectsQuery.data ?? []}
			selectedSession={selectedSession}
			sidebarControlId={SIDEBAR_CONTROL_ID}
			sidebarToggleRef={sidebarToggleRef}
			sessions={sessions}
			sessionsError={sessionsQuery.error}
			streamLines={streamLines}
			workingStartedAt={workingStartedAt}
			onAnswerChange={(index, value) =>
				clarificationState.updateAnswerDraft(selectedSessionId, index, value)
			}
			onArchiveSession={(sessionId) => void archiveSession(sessionId)}
			onCloseSidebar={closeMobileSidebar}
			onCloseTaskDetails={taskDetails.close}
			onDraftChange={handleDraftChange}
			onNewSession={() => void startNewSession(true)}
			onToggleTaskDetails={taskDetails.toggle}
			onSearch={() => {
				closeMobileSidebar();
				onSearchRequest();
			}}
			onSelectCommand={setDraft}
			onSelectOption={(index, value) =>
				void clarificationSubmitters.submitAnswerValue(index, value)
			}
			onSelectSession={(sessionId) => {
				setActiveSessionId(sessionId);
				router.push(`/session/${encodeURIComponent(sessionId)}`);
				taskDetails.close();
				closeMobileSidebar();
			}}
			onSubmit={() => void handleSubmit()}
			onSubmitAnswers={() => void clarificationSubmitters.submitAnswers()}
		/>
	);
}
