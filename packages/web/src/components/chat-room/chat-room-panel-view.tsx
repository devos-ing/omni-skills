"use client";

import { cn } from "@/lib/utils";
import { type ReactElement, useState } from "react";
import { ChatClarificationComposer } from "./chat-clarification-composer";
import { ChatComposer } from "./chat-composer";
import { ChatComposerSkeleton } from "./chat-composer-skeleton";
import { ChatRoomHeader } from "./chat-room-header";
import {
	shouldShowChatRoomLoadingShell,
	shouldShowMissionProgressSkeleton,
} from "./chat-room-loading-state";
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
	runningSessionIds,
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
	const [isSessionSidebarCollapsed, setIsSessionSidebarCollapsed] =
		useState(false);
	const pendingQuestions = selectedSession?.pendingQuestions ?? [];
	const hasPendingQuestions = pendingQuestions.length > 0;
	const hasOpenTaskDetails = isTaskDetailPanelOpen && Boolean(activeTaskId);
	const showLoadingShell = shouldShowChatRoomLoadingShell({
		hasSelectedSession: Boolean(selectedSession),
		isMessagesLoading,
	});
	const showMissionSkeleton = shouldShowMissionProgressSkeleton({
		hasActiveTask: Boolean(activeTaskId),
		isChatRoomLoading: showLoadingShell,
	});
	const layoutClassName = cn(
		"relative grid h-[100dvh] min-w-0 grid-rows-[minmax(0,1fr)] overflow-hidden bg-background text-zinc-100",
		hasOpenTaskDetails
			? isSessionSidebarCollapsed
				? "md:grid-cols-[5.5rem_minmax(0,1fr)_26rem]"
				: "md:grid-cols-[18rem_minmax(0,1fr)_26rem]"
			: isSessionSidebarCollapsed
				? "md:grid-cols-[5.5rem_minmax(0,1fr)]"
				: "md:grid-cols-[18rem_minmax(0,1fr)]",
	);

	function toggleSessionSidebar(): void {
		setIsSessionSidebarCollapsed((current) => !current);
	}

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
				isCollapsed={isSessionSidebarCollapsed}
				isCreating={isCreatingSession}
				isLoading={isSessionListLoading}
				projects={projects}
				runningSessionIds={runningSessionIds}
				sidebarControlId={sidebarControlId}
				sessions={sessions}
				onArchiveSession={onArchiveSession}
				onCloseSidebar={onCloseSidebar}
				onNewSession={onNewSession}
				onSearch={onSearch}
				onSelectSession={onSelectSession}
				onToggleCollapsed={toggleSessionSidebar}
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
						isLoading={showLoadingShell}
						isPlanning={isPlanning}
						isThinking={isThinking}
						missionProgress={missionProgress}
						messages={messages}
						showMissionSkeleton={showMissionSkeleton}
						session={selectedSession}
						streamLines={streamLines}
						workingStartedAt={workingStartedAt}
						onDraftCommand={onSelectCommand}
					/>
					{showLoadingShell ? (
						<ChatComposerSkeleton />
					) : hasPendingQuestions ? (
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
