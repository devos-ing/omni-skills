"use client";

import { type ReactElement, useEffect, useRef, useState } from "react";

import { TextShimmer } from "@/components/loading/text-shimmer";
import { Typography } from "@/components/ui/typography";
import type { ChatMessageRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

import { ChatEnvironmentPanel } from "./chat-environment-panel";
import { resolveChatMessageDisplay } from "./chat-message-display";
import { ChatMissionProgress } from "./chat-mission-progress";
import { ChatTranscriptSkeleton } from "./chat-transcript-skeleton";
import { ChatSelectedSessionWelcome } from "./chat-welcome-states";
import type { ChatTranscriptProps } from "./types/chat-room.types";

export function ChatTranscript({
	error,
	isLoading,
	isThinking,
	missionProgress,
	messages,
	session,
	streamLines,
	workingStartedAt,
	onDraftCommand,
}: ChatTranscriptProps): ReactElement {
	const scrollContainerRef = useRef<HTMLDivElement>(null);
	const previousSessionIdRef = useRef<string | null>(null);
	const sessionId = session?.id ?? null;
	const sessionTaskId = session?.taskId ?? null;
	const missionTaskId = missionProgress?.taskId ?? null;
	const missionIsPending =
		Boolean(sessionTaskId) &&
		(missionTaskId !== sessionTaskId || missionProgress?.state === "loading");
	const renderedContentKey = [
		messages.length,
		missionProgress?.updatedAt ?? "",
		missionProgress?.notes.length ?? 0,
		missionProgress?.executions.length ?? 0,
		missionProgress?.latestLogLines.length ?? 0,
		streamLines.length,
	].join(":");
	const showThinking = isThinking && streamLines.length === 0;
	const showWorkingHeader =
		Boolean(workingStartedAt) && (showThinking || streamLines.length > 0);
	const showStandaloneStream = streamLines.length > 0 && !missionProgress;
	const hasSessionActivity =
		messages.length > 0 ||
		streamLines.length > 0 ||
		Boolean(missionProgress) ||
		showWorkingHeader;

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
				<ChatMissionProgress
					liveLogLines={streamLines}
					mission={missionProgress}
				/>
				<div
					className="mx-auto grid w-full min-w-0 max-w-4xl gap-4"
					data-chat-transcript-message-column="true"
				>
					{isLoading ? <ChatTranscriptSkeleton /> : null}
					{error ? <ErrorLine text={error.message} /> : null}
					{!isLoading && messages.length === 0 && !missionProgress ? (
						<ChatSelectedSessionWelcome />
					) : null}
					{messages.map((message) => (
						<ChatMessageBubble key={message.id} message={message} />
					))}
					{showWorkingHeader ? (
						<WorkingSectionHeader startedAt={workingStartedAt ?? ""} />
					) : null}
					{showThinking ? <ThinkingLine /> : null}
					{showStandaloneStream ? (
						<div className="justify-self-start whitespace-pre-wrap rounded-md border border-border bg-surface-panel px-3 py-2 font-mono text-xs text-zinc-300">
							{streamLines.map((line) => (
								<div
									className={line.stream === "stderr" ? "text-red-200" : ""}
									key={line.id}
								>
									{line.text}
								</div>
							))}
						</div>
					) : null}
				</div>
			</div>
			{/* {hasSessionActivity ? (
				<ChatEnvironmentPanel
					missionProgress={missionProgress}
					projectId={session?.projectId ?? null}
					onDraftCommand={onDraftCommand}
				/>
			) : null} */}
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
				Working for {formatElapsedSeconds(startedAt, now)}s
			</Typography>
			<div className="h-px bg-surface-active" />
		</div>
	);
}

function formatElapsedSeconds(startedAt: string, now: number): number {
	const startedTime = new Date(startedAt).getTime();
	if (!Number.isFinite(startedTime)) {
		return 1;
	}
	return Math.max(1, Math.floor((now - startedTime) / 1000));
}

function ThinkingLine(): ReactElement {
	return <TextShimmer>Thinking...</TextShimmer>;
}

function ChatMessageBubble({
	message,
}: {
	message: ChatMessageRecord;
}): ReactElement {
	const isUser = message.role === "user";
	const display = resolveChatMessageDisplay(message);
	if (display === "assistant-note") {
		return <AssistantNote message={message} />;
	}
	if (display === "plan") {
		return <PlanMessage message={message} />;
	}
	const isError = display === "error";
	return (
		<article
			data-chat-message-display={display}
			className={cn(
				"grid max-w-[min(42rem,90%)] gap-2 rounded-md border px-3 py-2 text-sm",
				isUser
					? "justify-self-end border-zinc-700 bg-surface-active text-zinc-100"
					: "justify-self-start border-border bg-surface-panel text-zinc-200",
				isError && "border-red-900/60 bg-red-950/30 text-red-100",
			)}
		>
			<Typography className="whitespace-pre-wrap break-words leading-6">
				{message.content}
			</Typography>
		</article>
	);
}

function AssistantNote({
	message,
}: {
	message: ChatMessageRecord;
}): ReactElement {
	return (
		<article
			className="grid max-w-[min(42rem,90%)] justify-self-start gap-2 px-1 py-1 text-sm text-zinc-300"
			data-chat-message-display="assistant-note"
		>
			<Typography className="whitespace-pre-wrap break-words leading-6">
				{message.content}
			</Typography>
		</article>
	);
}

function PlanMessage({
	message,
}: {
	message: ChatMessageRecord;
}): ReactElement {
	return (
		<article
			className="grid max-w-[min(46rem,94%)] justify-self-start gap-2 rounded-md border border-blue-900/50 bg-surface-plan px-3 py-2 text-sm text-zinc-200"
			data-chat-message-display="plan"
		>
			<Typography className="text-blue-300" variant="eyebrow">
				Plan
			</Typography>
			<Typography className="whitespace-pre-wrap break-words leading-6">
				{message.content}
			</Typography>
		</article>
	);
}

function ErrorLine({ text }: { text: string }): ReactElement {
	return (
		<Typography
			className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-red-100"
			variant="error"
		>
			{text}
		</Typography>
	);
}
