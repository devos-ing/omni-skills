"use client";
import { useRouter } from "next/navigation";
import { type ReactElement, useState } from "react";
import { toast } from "sonner";

import { createWebApiClient } from "@/lib/api";
import {
	useAppendChatMessageMutation,
	useChatMessagesQuery,
	useChatSessionsQuery,
	useCreateChatSessionMutation,
	useSendChatMessageMutation,
	useUpdateChatSessionMutation,
} from "@/lib/api/chat-queries";
import { useCurrentWorkspaceQuery } from "@/lib/api/queries";
import { useRealtimeStore } from "@/lib/realtime";

import { useChatClarificationState } from "./chat-clarification-state";
import { createChatClarificationSubmitters } from "./chat-clarification-submitters";
import {
	createStreamLine,
	streamLineFromCommandEvent,
} from "./chat-command-stream-lines";
import { parseChatCommand } from "./chat-command-utils";
import { executeChatRoomInput } from "./chat-room-execute-input";
import { useChatRoomMission } from "./chat-room-mission";
import { useChatRoomDraftState } from "./chat-room-panel-draft-state";
import { ChatRoomPanelView } from "./chat-room-panel-view";
import { selectChatSession } from "./chat-room-selection";
import { resolveChatRoomStreamState } from "./chat-room-stream-state";
import { resolveChatSessionRerunState } from "./chat-session-rerun-state";
import { useWorkingSectionState } from "./chat-working-section-state";
import type * as CRT from "./types/chat-room.types";
import { useChatRoomContentModeState } from "./use-chat-room-content-mode-state";

const NO_REFETCH = { refetchIntervalMs: false } as const;
const apiClient = createWebApiClient();

export function ChatRoomPanel({
	commandDraftRequest,
	initialSessionId = "",
	onOpenSidebar,
}: CRT.ChatRoomPanelProps): ReactElement {
	const [activeSessionId, setActiveSessionId] = useState(initialSessionId);
	const [draft, setDraft] = useState("");
	const [commandLines, setCommandLines] = useState<CRT.ChatStreamLine[]>([]);
	const [isRerunning, setIsRerunning] = useState(false);
	const [submittedRerunKey, setSubmittedRerunKey] = useState("");
	const clarificationState = useChatClarificationState();
	const router = useRouter();
	const { runWithWorkingLabel, workingStartedAt } = useWorkingSectionState();
	const { handleDraftChange, markCommandDraftHandled } = useChatRoomDraftState({
		commandDraftRequest,
		setDraft,
	});
	const currentWorkspaceQuery = useCurrentWorkspaceQuery(NO_REFETCH);
	const workspaceId = currentWorkspaceQuery.data?.workspaceId ?? "";
	const sessionsQuery = useChatSessionsQuery(workspaceId, NO_REFETCH);
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
	const {
		activeTask,
		activeTaskId,
		isPlanning,
		missionProgress,
		refetchActiveTask,
	} = useChatRoomMission(selectedSession, messages);
	const contentMode = useChatRoomContentModeState({
		activeTaskId,
		selectedSessionId,
	});
	const { pendingAnswers, pendingQuestionIndex } =
		clarificationState.readPending(selectedSessionId);
	const chatStreamsByRunId = useRealtimeStore(
		(state) => state.chatStreamsByRunId,
	);
	const { activityStartedAt, isThinking, streamLines } =
		resolveChatRoomStreamState(
			commandLines,
			chatStreamsByRunId,
			selectedSessionId,
			sendMessage.isPending,
			sendMessage.variables?.sessionId,
		);
	const mutationBusy =
		createSession.isPending ||
		updateSession.isPending ||
		appendMessage.isPending ||
		sendMessage.isPending;
	const isBusy = currentWorkspaceQuery.isLoading || mutationBusy;
	const rerunSubmissionKey = `${selectedSession?.id}:${selectedSession?.updatedAt}`;
	const rerunState = resolveChatSessionRerunState({
		hasSubmittedRerun: submittedRerunKey === rerunSubmissionKey,
		isBusy: isBusy || isRerunning,
		session: selectedSession,
		task: activeTask,
	});
	const clarificationSubmitters = createChatClarificationSubmitters({
		clarificationState,
		pendingAnswers,
		pendingQuestionIndex,
		runWithWorkingLabel,
		selectedSession,
		sendMessage: (input) => sendMessage.mutateAsync(input),
	});

	async function startNewSession(): Promise<void> {
		if (!workspaceId) {
			toast.error("Workspace is still loading.");
			return;
		}
		const session = await createSession.mutateAsync({ workspaceId });
		setActiveSessionId(session.id);
		router.push(`/session/${encodeURIComponent(session.id)}`);
		setDraft("");
		contentMode.openMessages();
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
				await executeChatRoomInput(
					{
						appendMessage: (input) => appendMessage.mutateAsync(input),
						sendMessage: (input) => sendMessage.mutateAsync(input),
						setStreamLines: setCommandLines,
						startNewSession,
						updateProject: ({ sessionId: targetSessionId, projectId }) =>
							updateSession.mutateAsync({
								sessionId: targetSessionId,
								session: { projectId },
							}),
					},
					session.id,
					content,
					command,
				);
			});
		} catch (error) {
			toast.error(error instanceof Error ? error.message : "Send failed");
		}
	}
	async function handleRerunWorkflow(): Promise<void> {
		if (!rerunState.command) {
			toast.error("Workflow cannot be rerun yet.");
			return;
		}
		let finalStatus: "succeeded" | "failed" | "rejected" | null = null;
		let finalError: string | undefined;
		setIsRerunning(true);
		setSubmittedRerunKey(rerunSubmissionKey);
		setCommandLines([createStreamLine("system", "Queued workflow rerun.")]);
		try {
			await apiClient.streamCliCommand(rerunState.command, (event) => {
				if (event.type === "complete") {
					finalStatus = event.result.status;
					finalError = event.result.error;
				}
				const line = streamLineFromCommandEvent(event);
				if (line) setCommandLines((current) => [...current, line]);
			});
			await Promise.allSettled([
				sessionsQuery.refetch(),
				messagesQuery.refetch(),
				refetchActiveTask(),
			]);
			if (finalStatus && finalStatus !== "succeeded") {
				toast.error(finalError ?? "Workflow rerun failed.");
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Workflow rerun failed.";
			setCommandLines((current) => [
				...current,
				createStreamLine("stderr", message),
			]);
			toast.error(message);
		} finally {
			setIsRerunning(false);
		}
	}

	return (
		<ChatRoomPanelView
			activeContentMode={contentMode.contentMode}
			activeTaskId={activeTaskId}
			draft={draft}
			isBusy={isBusy}
			isMessagesLoading={messagesQuery.isLoading}
			isRerunDisabled={rerunState.isDisabled}
			isRerunning={isRerunning}
			isRerunVisible={rerunState.isVisible}
			isSending={sendMessage.isPending}
			isPlanning={isPlanning}
			isThinking={isThinking}
			missionProgress={missionProgress}
			messages={messages}
			messagesError={messagesQuery.error}
			pendingAnswers={pendingAnswers}
			pendingQuestionIndex={pendingQuestionIndex}
			selectedSession={selectedSession}
			streamLines={streamLines}
			workingStartedAt={workingStartedAt ?? activityStartedAt}
			onAnswerChange={(index, value) =>
				clarificationState.updateAnswerDraft(selectedSessionId, index, value)
			}
			onDraftChange={handleDraftChange}
			onOpenAction={contentMode.openAction}
			onOpenMessages={contentMode.openMessages}
			onOpenSidebar={onOpenSidebar}
			onOpenTaskDetails={contentMode.openTaskDetails}
			onRerunWorkflow={() => void handleRerunWorkflow()}
			onSelectCommand={setDraft}
			onSelectOption={(index, value) =>
				clarificationSubmitters.submitAnswerValue(index, value)
			}
			onSubmit={() => void handleSubmit()}
			onSubmitAnswers={() => void clarificationSubmitters.submitAnswers()}
		/>
	);
}
