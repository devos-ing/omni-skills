"use client";
import { TextShimmer } from "@/components/loading/text-shimmer";
import { Typography } from "@/components/ui/typography";
import { type ReactElement, useEffect, useRef, useState } from "react";
import {
	ChatMessageBubble,
	ErrorLine,
	PlanMessage,
} from "./chat-message-bubbles";
import { ChatMissionProgress } from "./chat-mission-progress";
import { ChatMissionProgressSkeleton } from "./chat-mission-progress-skeleton";
import { resolveMissionPlanMessageContent } from "./chat-plan-message-state";
import { ChatSessionActivitySections } from "./chat-session-activity-bubbles";
import { createChatSessionActivitySections } from "./chat-session-activity-state";
import { ChatSessionAgentOutputBubbles } from "./chat-session-agent-output-bubbles";
import { createChatSessionAgentOutputs } from "./chat-session-agent-output-state";
import { ChatStandaloneStreamBlock } from "./chat-standalone-stream-block";
import { ChatTranscriptSkeleton } from "./chat-transcript-skeleton";
import { formatWaitDurationLabel } from "./chat-wait-label";
import type { ChatTranscriptProps } from "./types/chat-room.types";
export function ChatTranscript({
	error,
	isLoading,
	isPlanning,
	isThinking,
	missionProgress,
	messages,
	showMissionSkeleton,
	session,
	streamLines,
	workingStartedAt,
}: ChatTranscriptProps): ReactElement {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const previousSessionIdRef = useRef<string | null>(null);
	const sessionId = session?.id ?? null;
	const sessionTaskId = session?.taskId ?? null;
	const missionTaskId = missionProgress?.taskId ?? null;
	const missionIsPending =
		Boolean(sessionTaskId) &&
		(missionTaskId !== sessionTaskId || missionProgress?.state === "loading");
	const activitySections = createChatSessionActivitySections({
		missionProgress,
		streamLines,
	});
	const planMessageContent = resolveMissionPlanMessageContent(
		missionProgress,
		messages,
	);
	const agentOutputs = createChatSessionAgentOutputs({
		messages,
		missionProgress,
		planMessageContent,
		streamLines,
	});
	const renderedContentKey = [
		messages.length,
		missionProgress?.updatedAt ?? "",
		missionProgress?.notes.length ?? 0,
		missionProgress?.executions.length ?? 0,
		missionProgress?.latestLogLines.length ?? 0,
		streamLines.length,
		activitySections
			.map(
				(section) =>
					`${section.id}:${section.details.map((detail) => detail.id).join("|")}`,
			)
			.join(","),
		agentOutputs.map((output) => output.id).join(","),
	].join(":");
	const hasActivitySections = activitySections.length > 0;
	const hasAgentOutputs = agentOutputs.length > 0;
	const showThinking =
		isThinking &&
		streamLines.length === 0 &&
		!hasActivitySections &&
		!hasAgentOutputs;
	const showPlanning =
		isPlanning &&
		!showThinking &&
		streamLines.length === 0 &&
		!hasActivitySections &&
		!hasAgentOutputs;
	const showWorkingHeader =
		Boolean(workingStartedAt) &&
		(showThinking ||
			showPlanning ||
			streamLines.length > 0 ||
			hasActivitySections ||
			hasAgentOutputs);
	const showStandaloneStream =
		streamLines.length > 0 &&
		!missionProgress &&
		!hasActivitySections &&
		!hasAgentOutputs;
	useEffect(() => {
		if (!sessionId) {
			previousSessionIdRef.current = null;
			return;
		}
		if (previousSessionIdRef.current === sessionId || isLoading) return;
		if (missionIsPending) return;
		if (!renderedContentKey) return;
		const frame = window.requestAnimationFrame(() => {
			const container = scrollContainerRef.current;
			if (!container) return;
			container.scrollTop = container.scrollHeight;
			previousSessionIdRef.current = sessionId;
		});
		return () => window.cancelAnimationFrame(frame);
	}, [sessionId, isLoading, missionIsPending, renderedContentKey]);

	return (
		<div
			className="relative min-h-0 min-w-0 overflow-auto px-4 py-6"
			ref={scrollContainerRef}
		>
			<div className="mx-auto flex flex-col min-w-0 max-w-6xl gap-4">
				{showMissionSkeleton ? (
					<ChatMissionProgressSkeleton />
				) : (
					<ChatMissionProgress mission={missionProgress} />
				)}
				<div
					className="mx-auto grid w-full min-w-0 max-w-4xl gap-4"
					data-chat-transcript-message-column="true"
				>
					{isLoading ? <ChatTranscriptSkeleton /> : null}
					{error ? <ErrorLine text={error.message} /> : null}
					{messages.map((message) => (
						<ChatMessageBubble key={message.id} message={message} />
					))}
					{planMessageContent ? (
						<PlanMessage content={planMessageContent} />
					) : null}
					{showWorkingHeader ? (
						<WorkingSectionHeader startedAt={workingStartedAt ?? ""} />
					) : null}
					<ChatSessionAgentOutputBubbles outputs={agentOutputs} />
					<ChatSessionActivitySections sections={activitySections} />
					{showThinking ? <ThinkingLine /> : null}
					{showPlanning ? <PlanningLine /> : null}
					{showStandaloneStream ? (
						<ChatStandaloneStreamBlock lines={streamLines} />
					) : null}
				</div>
			</div>
		</div>
	);
}

function WorkingSectionHeader({
	startedAt,
}: {
	startedAt: string;
}): ReactElement {
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const timer = window.setInterval(() => setNow(Date.now()), 1000);
		return () => window.clearInterval(timer);
	}, []);

	return (
		<div className="grid gap-4 pt-2">
			<Typography className="" variant="description">
				{formatWaitDurationLabel(startedAt, now)}
			</Typography>
			<div className="h-px bg-surface-active" />
		</div>
	);
}

function ThinkingLine(): ReactElement {
	return (
		<div className="p-1">
			<TextShimmer>Thinking...</TextShimmer>
		</div>
	);
}

function PlanningLine(): ReactElement {
	return (
		<div className="p-1">
			<TextShimmer>Planning...</TextShimmer>
		</div>
	);
}
