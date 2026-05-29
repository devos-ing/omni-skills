"use client";

import { ChevronDown } from "lucide-react";
import type { ReactElement } from "react";

import { TextShimmer } from "@/components/loading/text-shimmer";

import type { ChatSessionActivitySection } from "./types/chat-session-activity.types";

export function ChatSessionActivitySections({
	sections,
}: {
	sections: ChatSessionActivitySection[];
}): ReactElement | null {
	if (sections.length === 0) return null;
	return (
		<>
			{sections.map((section) => (
				<ActivitySection key={section.id} section={section} />
			))}
		</>
	);
}

function ActivitySection({
	section,
}: {
	section: ChatSessionActivitySection;
}): ReactElement {
	const logCount =
		section.details.length === 1 ? "1 log" : `${section.details.length} logs`;
	return (
		<details
			className="group grid max-w-[min(34rem,90%)] justify-self-start rounded-md border border-border bg-surface-panel px-3 py-2 text-sm text-zinc-300"
			data-chat-activity-section={section.id}
		>
			<summary className="flex cursor-pointer list-none items-center gap-2 [&::-webkit-details-marker]:hidden">
				<span className="min-w-0 flex-1">
					<TextShimmer>{section.summary}</TextShimmer>
				</span>
				<span className="shrink-0 text-xs text-muted-foreground">
					{logCount}
				</span>
				<ChevronDown
					aria-hidden="true"
					className="size-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
				/>
			</summary>
			<ol className="mt-2 grid gap-1 border-t border-border/70 pt-2">
				{section.details.map((detail) => (
					<li
						className="min-w-0 break-words font-mono text-[11px] leading-5 text-zinc-400"
						data-chat-activity-detail={detail.id}
						key={detail.id}
					>
						{detail.text}
					</li>
				))}
			</ol>
		</details>
	);
}
