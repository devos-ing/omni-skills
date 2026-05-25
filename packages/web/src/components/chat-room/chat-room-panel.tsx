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
import { useWorkspaceProjectsQuery } from "@/lib/api/realtime-queries";

import { parseChatCommand } from "./chat-command-utils";
import { ChatComposer } from "./chat-composer";
import { executeCommandInput } from "./chat-room-command-actions";
import { ChatRoomSidebar } from "./chat-room-sidebar";
import { LOCAL_WORKSPACE_ID } from "./chat-room.constants";
import { ChatTranscript } from "./chat-transcript";
import type {
	ChatAnswerPayload,
	ChatRoomPanelProps,
	ChatStreamLine,
} from "./types/chat-room.types";

export function ChatRoomPanel({
	newSessionRequest,
}: ChatRoomPanelProps): ReactElement {
	const [activeSessionId, setActiveSessionId] = useState("");
	const [draft, setDraft] = useState("");
	const [answerDrafts, setAnswerDrafts] = useState<Record<string, string[]>>(
		{},
	);
	const [streamLines, setStreamLines] = useState<ChatStreamLine[]>([]);
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const handledNewSessionRequest = useRef(0);

	const sessionsQuery = useChatSessionsQuery(LOCAL_WORKSPACE_ID, {
		refetchIntervalMs: false,
	});
	const projectsQuery = useWorkspaceProjectsQuery(LOCAL_WORKSPACE_ID, {
		refetchIntervalMs: false,
	});
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
	const isBusy =
		createSession.isPending ||
		updateSession.isPending ||
		appendMessage.isPending ||
		sendMessage.isPending;

	useEffect(() => {
		if (
			newSessionRequest > 0 &&
			newSessionRequest !== handledNewSessionRequest.current
		) {
			handledNewSessionRequest.current = newSessionRequest;
			void startNewSession();
		}
	}, [newSessionRequest]);

	async function startNewSession(): Promise<void> {
		setErrorMessage(null);
		const session = await createSession.mutateAsync({
			workspaceId: LOCAL_WORKSPACE_ID,
		});
		setActiveSessionId(session.id);
		setDraft("");
	}

	async function ensureSession() {
		if (selectedSession) {
			return selectedSession;
		}
		const session = await createSession.mutateAsync({
			workspaceId: LOCAL_WORKSPACE_ID,
		});
		setActiveSessionId(session.id);
		return session;
	}

	async function handleSubmit(): Promise<void> {
		const content = draft.trim();
		if (!content || isBusy) {
			return;
		}
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
		<section className="grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-[#0f1013] text-zinc-100 md:grid-cols-[auto_minmax(0,1fr)]">
			<ChatRoomSidebar
				activeSessionId={selectedSessionId}
				isCreating={createSession.isPending}
				projects={projectsQuery.data ?? []}
				sessions={sessions}
				onNewSession={() => void startNewSession()}
				onSelectSession={setActiveSessionId}
			/>
			<div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
				<header className="border-b border-zinc-900 bg-[#111216] px-4 py-3">
					<h1 className="m-0 truncate text-base font-semibold">
						{selectedSession?.title ?? "Untitled"}
					</h1>
					<p className="m-0 mt-1 truncate text-xs text-zinc-500">
						{selectedSession?.taskId ? (
							<a
								className="underline-offset-4 hover:text-zinc-300 hover:underline"
								href={`/issues/${encodeURIComponent(selectedSession.taskId)}`}
							>
								Issue {selectedSession.taskId}
							</a>
						) : (
							(selectedSession?.projectId ?? "default")
						)}
					</p>
				</header>
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

function replaceAt(values: string[], index: number, value: string): string[] {
	const next = [...values];
	next[index] = value;
	return next;
}
