"use client";

import { useUiStore } from "@/lib/ui-store";
import type { ReactElement } from "react";
import { ChatActionStatusView } from "./chat-action-status-view";
import { ChatClarificationComposer } from "./chat-clarification-composer";
import { ChatComposer } from "./chat-composer";
import { ChatComposerSkeleton } from "./chat-composer-skeleton";
import { ChatRoomHeader } from "./chat-room-header";
import {
	shouldShowChatRoomLoadingShell,
	shouldShowMissionProgressSkeleton,
} from "./chat-room-loading-state";
import { resolveChatRoomPanelLayout } from "./chat-room-panel-layout";
import { ChatTaskDetailView } from "./chat-task-detail-view";
import { ChatTranscript } from "./chat-transcript";
import { ChatNoSessionHome } from "./chat-welcome-states";
import type { ChatRoomPanelViewProps } from "./types/chat-room.types";

export function ChatRoomPanelView({
	activeContentMode,
	activeTaskId,
	draft,
	isBusy,
	isMessagesLoading,
	isRerunDisabled,
	isRerunning,
	isRerunVisible,
	isSending,
	isPlanning,
	isThinking,
	missionProgress,
	messages,
	messagesError,
	pendingAnswers,
	pendingQuestionIndex,
	selectedSession,
	streamLines,
	workingStartedAt,
	onAnswerChange,
	onDraftChange,
	onOpenAction,
	onOpenMessages,
	onOpenSidebar,
	onOpenTaskDetails,
	onRerunWorkflow,
	onSelectCommand,
	onSelectOption,
	onSubmit,
	onSubmitAnswers,
}: ChatRoomPanelViewProps): ReactElement {
	const messageInputFocusRequest = useUiStore(
		(state) => state.messageInputFocusRequest,
	);
	const clearMessageInputFocusRequest = useUiStore(
		(state) => state.clearMessageInputFocusRequest,
	);
	const pendingQuestions = selectedSession?.pendingQuestions ?? [];
	const hasPendingQuestions = pendingQuestions.length > 0;
	const messageInputFocusRequestId =
		messageInputFocusRequest &&
		messageInputFocusRequest.sessionId === selectedSession?.id
			? messageInputFocusRequest.id
			: null;
	const layout = resolveChatRoomPanelLayout({
		activeContentMode,
		hasActiveTask: Boolean(activeTaskId),
	});
	const showLoadingShell = shouldShowChatRoomLoadingShell({
		hasSelectedSession: Boolean(selectedSession),
		isMessagesLoading,
		isRealtimeActive: Boolean(workingStartedAt) || isPlanning || isThinking,
	});
	// const showLoadingShell = true
	const showMissionSkeleton = shouldShowMissionProgressSkeleton({
		hasActiveTask: Boolean(activeTaskId),
		isChatRoomLoading: showLoadingShell,
	});

	return (
		<section className={layout.rootClassName}>
			{selectedSession ? (
				<div className={layout.sessionClassName}>
					<ChatRoomHeader
						activeTaskId={activeTaskId}
						activeTab={layout.contentMode}
						isRerunDisabled={isRerunDisabled}
						isRerunning={isRerunning}
						isRerunVisible={isRerunVisible}
						title={selectedSession.title}
						onOpenAction={onOpenAction}
						onOpenMessages={onOpenMessages}
						onOpenSidebar={onOpenSidebar}
						onOpenTaskDetails={onOpenTaskDetails}
						onRerunWorkflow={onRerunWorkflow}
					/>
					{layout.contentMode === "taskDetails" ? (
						<ChatTaskDetailView taskId={activeTaskId} />
					) : layout.contentMode === "action" ? (
						<ChatActionStatusView
							missionProgress={missionProgress}
							showMissionSkeleton={showMissionSkeleton}
						/>
					) : (
						<>
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
									messageInputFocusRequestId={messageInputFocusRequestId}
									onDraftChange={onDraftChange}
									onMessageInputFocusRequestHandled={
										clearMessageInputFocusRequest
									}
									onSelectCommand={onSelectCommand}
									onSubmit={onSubmit}
								/>
							)}
						</>
					)}
				</div>
			) : (
				<ChatNoSessionHome
					disabled={isBusy}
					draft={draft}
					isSending={isSending}
					onDraftChange={onDraftChange}
					onOpenSidebar={onOpenSidebar}
					onSelectCommand={onSelectCommand}
					onSubmit={onSubmit}
				/>
			)}
		</section>
	);
}
