"use client";

import type { ReactElement } from "react";
import { ChatClarificationComposer } from "./chat-clarification-composer";
import { ChatComposer } from "./chat-composer";
import { ChatRoomHeader } from "./chat-room-header";
import { ChatRoomSidebar } from "./chat-room-sidebar";
import { ChatTaskDetailPanel } from "./chat-task-detail-sheet";
import { ChatTranscript } from "./chat-transcript";
import { ChatNoSessionHome } from "./chat-welcome-states";
import type { ChatRoomPanelViewProps } from "./types/chat-room.types";

export function ChatRoomPanelView({
	activeSessionId,
	activeTaskId,
	draft,
	isBusy,
	isCreatingSession,
	isMessagesLoading,
	isSessionListLoading,
	isSending,
	isPlanning,
	isTaskDetailPanelOpen,
	isThinking,
	missionProgress,
	messages,
	messagesError,
	pendingAnswers,
	pendingQuestionIndex,
	projects,
	selectedSession,
	sidebarControlId,
	sidebarToggleRef,
	sessions,
	sessionsError,
	streamLines,
	workingStartedAt,
	onAnswerChange,
	onArchiveSession,
	onCloseSidebar,
	onCloseTaskDetails,
	onDraftChange,
	onNewSession,
	onToggleTaskDetails,
	onSearch,
	onSelectCommand,
	onSelectOption,
	onSelectSession,
	onSubmit,
	onSubmitAnswers,
}: ChatRoomPanelViewProps): ReactElement {
	const pendingQuestions = selectedSession?.pendingQuestions ?? [];
	const hasPendingQuestions = pendingQuestions.length > 0;
	const hasOpenTaskDetails = isTaskDetailPanelOpen && Boolean(activeTaskId);
	const layoutClassName = hasOpenTaskDetails
		? "relative grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-background text-zinc-100 md:grid-cols-[18rem_minmax(0,1fr)_26rem]"
		: "relative grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-background text-zinc-100 md:grid-cols-[18rem_minmax(0,1fr)]";

	return (
		<section className={layoutClassName}>
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
				error={sessionsError}
				isCreating={isCreatingSession}
				isLoading={isSessionListLoading}
				projects={projects}
				sidebarControlId={sidebarControlId}
				sessions={sessions}
				onArchiveSession={onArchiveSession}
				onCloseSidebar={onCloseSidebar}
				onNewSession={onNewSession}
				onSearch={onSearch}
				onSelectSession={onSelectSession}
			/>
			{selectedSession ? (
				<div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)_auto]">
					<ChatRoomHeader
						activeTaskId={activeTaskId}
						isTaskDetailPanelOpen={hasOpenTaskDetails}
						projectId={selectedSession.projectId ?? "default"}
						sidebarControlId={sidebarControlId}
						title={selectedSession.title}
						onToggleTaskDetails={onToggleTaskDetails}
					/>
					<ChatTranscript
						error={messagesError}
						isLoading={isMessagesLoading}
						isPlanning={isPlanning}
						isThinking={isThinking}
						missionProgress={missionProgress}
						messages={messages}
						session={selectedSession}
						streamLines={streamLines}
						workingStartedAt={workingStartedAt}
						onDraftCommand={onSelectCommand}
					/>
					{hasPendingQuestions ? (
						<ChatClarificationComposer
							answers={pendingAnswers}
							disabled={isBusy || isSending}
							pendingQuestionIndex={pendingQuestionIndex}
							questions={pendingQuestions}
							onAnswerChange={onAnswerChange}
							onSelectOption={onSelectOption}
							onSubmit={onSubmitAnswers}
						/>
					) : (
						<ChatComposer
							disabled={isBusy}
							draft={draft}
							isSending={isSending}
							onDraftChange={onDraftChange}
							onSelectCommand={onSelectCommand}
							onSubmit={onSubmit}
						/>
					)}
				</div>
			) : (
				<ChatNoSessionHome
					disabled={isBusy}
					draft={draft}
					isSending={isSending}
					sidebarControlId={sidebarControlId}
					onDraftChange={onDraftChange}
					onSelectCommand={onSelectCommand}
					onSubmit={onSubmit}
				/>
			)}
			<ChatTaskDetailPanel
				isOpen={hasOpenTaskDetails}
				taskId={activeTaskId}
				onClose={onCloseTaskDetails}
			/>
		</section>
	);
}
