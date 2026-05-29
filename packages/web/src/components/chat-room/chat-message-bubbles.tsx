"use client";

import type { ChatMessageRecord } from "@/lib/api";
import type { ReactElement } from "react";

import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { resolveChatMessageDisplay } from "./chat-message-display";

export function ChatMessageBubble({
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
		return <PlanMessage content={message.content} />;
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

export function PlanMessage({ content }: { content: string }): ReactElement {
	return (
		<article
			className="grid max-w-[min(46rem,94%)] justify-self-start gap-2 rounded-md border border-blue-900/50 bg-surface-plan px-3 py-2 text-sm text-zinc-200"
			data-chat-message-display="plan"
		>
			<Typography className="text-blue-300" variant="eyebrow">
				Plan
			</Typography>
			<Typography className="whitespace-pre-wrap break-words leading-6">
				{content}
			</Typography>
		</article>
	);
}

export function ErrorLine({ text }: { text: string }): ReactElement {
	return (
		<Typography
			className="rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-red-100"
			variant="error"
		>
			{text}
		</Typography>
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
