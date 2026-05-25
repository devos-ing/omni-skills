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

import { parseChatCommand } from "./chat-command-utils";
import { ChatComposer } from "./chat-composer";
import { executeCommandInput } from "./chat-room-command-actions";
import { ChatRoomHeader } from "./chat-room-header";
import { ChatRoomSidebar } from "./chat-room-sidebar";
import { replaceAt } from "./chat-room-state-utils";
import { ChatTranscript } from "./chat-transcript";
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
	const [streamLines, setStreamLines] = useState<ChatStreamLine[]>([]);
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
				setStreamLines,
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
		<section className="relative grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-[#0f1013] text-zinc-100 md:grid-cols-[18rem_minmax(0,1fr)]">
			<input
				aria-hidden="true"
				className="peer sr-only"
				id={SIDEBAR_CONTROL_ID}
				ref={sidebarToggleRef}
				tabIndex={-1}
				type="checkbox"
			/>
			<label
				aria-label="Close chat sidebar"
				className="fixed inset-0 z-30 hidden bg-black/60 peer-checked:block md:hidden"
				htmlFor={SIDEBAR_CONTROL_ID}
			/>
			<ChatRoomSidebar
				activeSessionId={selectedSessionId}
				isCreating={createSession.isPending}
				projects={projectsQuery.data ?? []}
				sessions={sessions}
				onCloseSidebar={closeMobileSidebar}
				onNewSession={() => void startNewSession(true)}
				onSearch={() => {
					closeMobileSidebar();
					onSearchRequest();
				}}
				onSelectSession={(sessionId) => {
					setActiveSessionId(sessionId);
					closeMobileSidebar();
				}}
			/>
			<div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
				<ChatRoomHeader
					projectId={selectedSession?.projectId ?? "default"}
					sidebarControlId={SIDEBAR_CONTROL_ID}
					title={selectedSession?.title ?? "Untitled"}
				/>
				<ChatTranscript
					error={messagesQuery.error}
					isLoading={messagesQuery.isLoading}
					messages={messagesQuery.data ?? []}
					pendingAnswers={pendingAnswers}
					session={selectedSession}
					streamLines={streamLines}
					onAnswerChange={(index, value) =>
						setAnswerDrafts((current) => ({
							...current,
							[selectedSessionId]: replaceAt(pendingAnswers, index, value),
						}))
					}
					onSubmitAnswers={() => void submitAnswers()}
				/>
				{errorMessage ? (
					<p className="m-0 border-t border-red-900/60 bg-red-950/30 px-4 py-2 text-sm text-red-100">
						{errorMessage}
					</p>
				) : null}
				<ChatComposer
					disabled={isBusy}
					draft={draft}
					isSending={sendMessage.isPending}
					onDraftChange={setDraft}
					onSelectCommand={setDraft}
					onSubmit={() => void handleSubmit()}
				/>
			</div>
		</section>
	);
}
