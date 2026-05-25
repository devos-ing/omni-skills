"use client";

import type {
	ChatMessageRecord,
	ChatSessionRecord,
	WorkspaceProjectRecord,
} from "@/lib/api";
import type { ReactElement, RefObject } from "react";
import { ChatComposer } from "./chat-composer";
import { ChatRoomHeader } from "./chat-room-header";
import { ChatRoomSidebar } from "./chat-room-sidebar";
import { ChatTranscript } from "./chat-transcript";
import type { ChatStreamLine } from "./types/chat-room.types";

export interface ChatRoomPanelViewProps {
	activeSessionId: string;
	draft: string;
	errorMessage: string | null;
	isBusy: boolean;
	isCreatingSession: boolean;
	isMessagesLoading: boolean;
	isSending: boolean;
	messages: ChatMessageRecord[];
	messagesError: Error | null;
	pendingAnswers: string[];
	projects: WorkspaceProjectRecord[];
	selectedSession: ChatSessionRecord | null;
	sidebarControlId: string;
	sidebarToggleRef: RefObject<HTMLInputElement | null>;
	sessions: ChatSessionRecord[];
	streamLines: ChatStreamLine[];
	onAnswerChange: (index: number, value: string) => void;
	onCloseSidebar: () => void;
	onDraftChange: (value: string) => void;
	onNewSession: () => void;
	onSearch: () => void;
	onSelectCommand: (value: string) => void;
	onSelectSession: (sessionId: string) => void;
	onSubmit: () => void;
	onSubmitAnswers: () => void;
}

export function ChatRoomPanelView({
	activeSessionId,
	draft,
	errorMessage,
	isBusy,
	isCreatingSession,
	isMessagesLoading,
	isSending,
	messages,
	messagesError,
	pendingAnswers,
	projects,
	selectedSession,
	sidebarControlId,
	sidebarToggleRef,
	sessions,
	streamLines,
	onAnswerChange,
	onCloseSidebar,
	onDraftChange,
	onNewSession,
	onSearch,
	onSelectCommand,
	onSelectSession,
	onSubmit,
	onSubmitAnswers,
}: ChatRoomPanelViewProps): ReactElement {
	return (
		<section className="relative grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-[#0f1013] text-zinc-100 md:grid-cols-[18rem_minmax(0,1fr)]">
			<input
				aria-hidden="true"
				className="peer sr-only"
				id={sidebarControlId}
				ref={sidebarToggleRef}
				tabIndex={-1}
				type="checkbox"
			/>
			<label
				aria-label="Close chat sidebar"
				className="fixed inset-0 z-30 hidden bg-black/60 peer-checked:block md:hidden"
				htmlFor={sidebarControlId}
			/>
			<ChatRoomSidebar
				activeSessionId={activeSessionId}
				isCreating={isCreatingSession}
				projects={projects}
				sessions={sessions}
				onCloseSidebar={onCloseSidebar}
				onNewSession={onNewSession}
				onSearch={onSearch}
				onSelectSession={onSelectSession}
			/>
			<div className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)_auto]">
				<ChatRoomHeader
					projectId={selectedSession?.projectId ?? "default"}
					sidebarControlId={sidebarControlId}
					title={selectedSession?.title ?? "Untitled"}
				/>
				<ChatTranscript
					error={messagesError}
					isLoading={isMessagesLoading}
					messages={messages}
					pendingAnswers={pendingAnswers}
					session={selectedSession}
					streamLines={streamLines}
					onAnswerChange={onAnswerChange}
					onSubmitAnswers={onSubmitAnswers}
				/>
				{errorMessage ? (
					<p className="m-0 border-t border-red-900/60 bg-red-950/30 px-4 py-2 text-sm text-red-100">
						{errorMessage}
					</p>
				) : null}
				<ChatComposer
					disabled={isBusy}
					draft={draft}
					isSending={isSending}
					onDraftChange={onDraftChange}
					onSelectCommand={onSelectCommand}
					onSubmit={onSubmit}
				/>
			</div>
		</section>
	);
}
