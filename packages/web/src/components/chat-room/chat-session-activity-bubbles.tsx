"use client";

import type { ReactElement } from "react";

import { TextShimmer } from "@/components/loading/text-shimmer";

import type { ChatSessionActivityBubble } from "./types/chat-session-activity.types";

export function ChatSessionActivityBubbles({
	bubbles,
}: {
	bubbles: ChatSessionActivityBubble[];
}): ReactElement | null {
	if (bubbles.length === 0) return null;
	return (
		<>
			{bubbles.map((bubble) => (
				<ActivityBubble key={bubble.id} bubble={bubble} />
			))}
		</>
	);
}

function ActivityBubble({
	bubble,
}: {
	bubble: ChatSessionActivityBubble;
}): ReactElement {
	return (
		<article className="grid max-w-[min(28rem,88%)] justify-self-start rounded-md border border-border bg-surface-panel px-3 py-2 text-sm text-zinc-300">
			<TextShimmer>{bubble.label}</TextShimmer>
		</article>
	);
}
