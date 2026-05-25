"use client";

import { type ReactElement, useEffect, useMemo, useRef, useState } from "react";

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

import { parseChatCommand } from "./chat-command-utils";
import { executeCommandInput } from "./chat-room-command-actions";
import { ChatRoomPanelView } from "./chat-room-panel-view";
import { replaceAt } from "./chat-room-state-utils";
import { chatStreamLinesForSession } from "./chat-room-stream-utils";
import type {
	ChatAnswerPayload,
	ChatRoomPanelProps,
	ChatStreamLine,
} from "./types/chat-room.types";

const SIDEBAR_CONTROL_ID = "chat-sidebar-toggle";
const NO_REFETCH = { refetchIntervalMs: false } as const;

export function ChatRoomPanel({
	newSessionRequest,
	onSearchRequest,
}: ChatRoomPanelProps): ReactElement {
	const [activeSessionId, setActiveSessionId] = useState("");
	const [draft, setDraft] = useState("");
	const [answerDrafts, setAnswerDrafts] = useState<Record<string, string[]>>(
		{},
	);
	const [commandStreamLines, setCommandStreamLines] = useState<
		ChatStreamLine[]
	>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
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
	const selectedSession = useMemo(
		() => sessions.find((session) => session.id === selectedSessionId) ?? null,
		[sessions, selectedSessionId],
	);
	const messagesQuery = useChatMessagesQuery(selectedSessionId, {
		enabled: Boolean(selectedSessionId),
		refetchIntervalMs: false,
	});
	const pendingAnswers = selectedSessionId
		? (answerDrafts[selectedSessionId] ?? [])
		: [];
	const chatStreamsByRunId = useRealtimeStore(
		(state) => state.chatStreamsByRunId,
	);
	const streamLines = [
		...commandStreamLines,
		...chatStreamLinesForSession(chatStreamsByRunId, selectedSessionId),
	];
	const mutationBusy =
		createSession.isPending ||
		updateSession.isPending ||
		appendMessage.isPending ||
		sendMessage.isPending;
	const isBusy = currentWorkspaceQuery.isLoading || mutationBusy;

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
		if (!selectedSession?.pendingQuestions.length) {
			return;
		}
		const answers: ChatAnswerPayload = selectedSession.pendingQuestions.map(
			(question, index) => ({
				question,
				answer: pendingAnswers[index]?.trim() ?? "",
			}),
		);
		if (answers.some((answer) => !answer.answer)) {
			return;
		}
		await sendMessage.mutateAsync({
			sessionId: selectedSession.id,
			message: {
				content: answers.map((answer) => answer.answer).join("\n"),
				answers,
			},
		});
		setAnswerDrafts((current) => ({ ...current, [selectedSession.id]: [] }));
	}

	return (
		<ChatRoomPanelView
			activeSessionId={selectedSessionId}
			draft={draft}
			errorMessage={errorMessage}
			isBusy={isBusy}
			isCreatingSession={createSession.isPending}
			isMessagesLoading={messagesQuery.isLoading}
			isSending={sendMessage.isPending}
			messages={messagesQuery.data ?? []}
			messagesError={messagesQuery.error}
			pendingAnswers={pendingAnswers}
			projects={projectsQuery.data ?? []}
			selectedSession={selectedSession}
			sidebarControlId={SIDEBAR_CONTROL_ID}
			sidebarToggleRef={sidebarToggleRef}
			sessions={sessions}
			streamLines={streamLines}
			onAnswerChange={(index, value) =>
				setAnswerDrafts((current) => ({
					...current,
					[selectedSessionId]: replaceAt(pendingAnswers, index, value),
				}))
			}
			onCloseSidebar={closeMobileSidebar}
			onDraftChange={setDraft}
			onNewSession={() => void startNewSession(true)}
			onSearch={() => {
				closeMobileSidebar();
				onSearchRequest();
			}}
			onSelectCommand={setDraft}
			onSelectSession={(sessionId) => {
				setActiveSessionId(sessionId);
				closeMobileSidebar();
			}}
			onSubmit={() => void handleSubmit()}
			onSubmitAnswers={() => void submitAnswers()}
		/>
	);
}
