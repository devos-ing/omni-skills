"use client";

import { type ReactElement, useEffect, useRef, useState } from "react";

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
import { parseChatCommand } from "./chat-command-utils";
import { executeCommandInput } from "./chat-room-command-actions";
import { ChatRoomPanelView } from "./chat-room-panel-view";
import { chatStreamLinesForSession } from "./chat-room-stream-utils";
import { findActiveTaskId } from "./chat-task-utils";
import { shouldShowChatThinkingIndicator } from "./chat-thinking-state";
import type {
	ChatStreamLine as Line,
	ChatRoomPanelProps as Props,
} from "./types/chat-room.types";

const SIDEBAR_CONTROL_ID = "chat-sidebar-toggle";
const NO_REFETCH = { refetchIntervalMs: false } as const;

export function ChatRoomPanel({
	commandDraftRequest,
	newSessionRequest,
	onSearchRequest,
}: Props): ReactElement {
	const [activeSessionId, setActiveSessionId] = useState("");
	const [draftValue, setDraft] = useState("");
	const [commandStreamLines, setCommandStreamLines] = useState<Line[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const [isTaskDetailSheetOpen, setIsTaskDetailSheetOpen] = useState(false);
	const clarificationState = useChatClarificationState();
	const handledCommandDraftRequest = useRef(0);
	const handledNewSessionRequest = useRef(0);
	const sidebarToggleRef = useRef<HTMLInputElement>(null);

	const currentWorkspaceQuery = useCurrentWorkspaceQuery(NO_REFETCH);
	const workspaceId = currentWorkspaceQuery.data?.workspaceId ?? "";
	const sessionsQuery = useChatSessionsQuery(workspaceId, NO_REFETCH);
	const projectsQuery = useWorkspaceProjectsQuery(workspaceId, NO_REFETCH);
	const createSession = useCreateChatSessionMutation();
	const updateSession = useUpdateChatSessionMutation();
	const appendMessage = useAppendChatMessageMutation();
	const sendMessage = useSendChatMessageMutation();

	const sessions = sessionsQuery.data ?? [];
	const selectedSessionId = activeSessionId || sessions[0]?.id || "";
	const selectedSession =
		sessions.find(({ id }) => id === selectedSessionId) ?? null;
	const messagesQuery = useChatMessagesQuery(selectedSessionId, {
		enabled: Boolean(selectedSessionId),
		refetchIntervalMs: false,
	});
	const messages = messagesQuery.data ?? [];
	const activeTaskId = findActiveTaskId(selectedSession, messages);
	const pendingAnswers = selectedSessionId
		? (clarificationState.answerDrafts[selectedSessionId] ?? [])
		: [];
	const pendingQuestionIndex = selectedSessionId
		? (clarificationState.answerStepBySession[selectedSessionId] ?? 0)
		: 0;
	const chatStreamsByRunId = useRealtimeStore(
		(state) => state.chatStreamsByRunId,
	);
	const streamLines = [
		...commandStreamLines,
		...chatStreamLinesForSession(chatStreamsByRunId, selectedSessionId),
	];
	const isThinking = shouldShowChatThinkingIndicator({
		hasPendingQuestions: Boolean(selectedSession?.pendingQuestions.length),
		isSending: sendMessage.isPending,
		selectedSessionId,
		sendingSessionId: sendMessage.variables?.sessionId,
		streamLineCount: streamLines.length,
	});
	const isBusy =
		currentWorkspaceQuery.isLoading ||
		[createSession, updateSession, appendMessage, sendMessage].some(
			(mutation) => mutation.isPending,
		);
	const pendingCommandDraftRequest =
		commandDraftRequest?.id === handledCommandDraftRequest.current
			? null
			: commandDraftRequest;
	const draft = pendingCommandDraftRequest?.draft ?? draftValue;

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
		setErrorMessage(null);
		if (!workspaceId) {
			setErrorMessage("Workspace is still loading.");
			return;
		}
		const session = await createSession.mutateAsync({ workspaceId });
		setActiveSessionId(session.id);
		setDraft("");
		if (closeSidebar) closeMobileSidebar();
	}

	function closeMobileSidebar(): void {
		const toggle = sidebarToggleRef.current;
		if (toggle) toggle.checked = false;
	}

	function markCommandDraftHandled(): void {
		if (pendingCommandDraftRequest) {
			handledCommandDraftRequest.current = pendingCommandDraftRequest.id;
		}
	}

	function handleDraftChange(value: string): void {
		markCommandDraftHandled();
		setDraft(value);
	}

	async function ensureSession() {
		if (selectedSession) {
			return selectedSession;
		}
		if (!workspaceId) {
			throw new Error("Workspace is still loading.");
		}
		const session = await createSession.mutateAsync({ workspaceId });
		setActiveSessionId(session.id);
		return session;
	}

	async function handleSubmit(): Promise<void> {
		const content = draft.trim();
		if (!content || isBusy) return;
		markCommandDraftHandled();
		setDraft("");
		setErrorMessage(null);
		try {
			const session = await ensureSession();
			const command = parseChatCommand(content, {
				projectId: session.projectId,
			});
			await executeInput(session.id, content, command);
		} catch (error) {
			setErrorMessage(error instanceof Error ? error.message : "Send failed");
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
				setStreamLines: setCommandStreamLines,
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

	async function submitAnswers(): Promise<void> {
		await clarificationState.submitAnswers({
			pendingAnswers,
			pendingQuestionIndex,
			selectedSession,
			sendAnswers: async ({ sessionId, content, answers }) => {
				await sendMessage.mutateAsync({
					sessionId,
					message: { content, answers },
				});
			},
		});
	}

	return (
		<ChatRoomPanelView
			activeSessionId={selectedSessionId}
			activeTaskId={activeTaskId}
			draft={draft}
			errorMessage={errorMessage}
			isBusy={isBusy}
			isCreatingSession={createSession.isPending}
			isMessagesLoading={messagesQuery.isLoading}
			isSending={sendMessage.isPending}
			isTaskDetailSheetOpen={isTaskDetailSheetOpen}
			isThinking={isThinking}
			messages={messages}
			messagesError={messagesQuery.error}
			pendingAnswers={pendingAnswers}
			pendingQuestionIndex={pendingQuestionIndex}
			projects={projectsQuery.data ?? []}
			selectedSession={selectedSession}
			sidebarControlId={SIDEBAR_CONTROL_ID}
			sidebarToggleRef={sidebarToggleRef}
			sessions={sessions}
			streamLines={streamLines}
			onAnswerChange={(index, value) =>
				clarificationState.updateAnswerDraft(selectedSessionId, index, value)
			}
			onCloseSidebar={closeMobileSidebar}
			onCloseTaskDetails={() => setIsTaskDetailSheetOpen(false)}
			onDraftChange={handleDraftChange}
			onNewSession={() => void startNewSession(true)}
			onOpenTaskDetails={() => setIsTaskDetailSheetOpen(true)}
			onSearch={() => {
				closeMobileSidebar();
				onSearchRequest();
			}}
			onSelectCommand={handleDraftChange}
			onSelectSession={(sessionId) => {
				setActiveSessionId(sessionId);
				closeMobileSidebar();
			}}
			onSubmit={() => void handleSubmit()}
			onSubmitAnswers={() => void submitAnswers()}
		/>
	);
}
