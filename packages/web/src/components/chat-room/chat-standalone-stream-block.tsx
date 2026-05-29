"use client";

import type { ReactElement } from "react";

import type { ChatStreamLine } from "./types/chat-room.types";

export function ChatStandaloneStreamBlock({
	lines,
}: {
	lines: ChatStreamLine[];
}): ReactElement | null {
	if (lines.length === 0) return null;
	return (
		<div className="justify-self-start whitespace-pre-wrap rounded-md border border-border bg-surface-panel px-3 py-2 font-mono text-xs text-zinc-300">
			{lines.map((line) => (
				<div
					className={line.stream === "stderr" ? "text-red-200" : ""}
					key={line.id}
				>
					{line.text}
				</div>
			))}
		</div>
	);
}
