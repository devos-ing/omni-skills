"use client";

import type { ReactElement } from "react";

import { Typography } from "@/components/ui/typography";

import type { ChatSessionAgentOutput } from "./types/chat-session-agent-output.types";

export function ChatSessionAgentOutputBubbles({
	outputs,
}: {
	outputs: ChatSessionAgentOutput[];
}): ReactElement | null {
	if (outputs.length === 0) return null;
	return (
		<>
			{outputs.map((output) => (
				<AgentOutputBubble key={output.id} output={output} />
			))}
		</>
	);
}

function AgentOutputBubble({
	output,
}: {
	output: ChatSessionAgentOutput;
}): ReactElement {
	return (
		<article
			className="grid max-w-[min(42rem,90%)] justify-self-start rounded-md border border-border bg-surface-panel px-3 py-2 text-sm text-zinc-200"
			data-chat-agent-output={output.id}
		>
			<Typography className="whitespace-pre-wrap break-words leading-6">
				{output.text}
			</Typography>
		</article>
	);
}
