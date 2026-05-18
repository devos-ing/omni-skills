import type { ReactElement, ReactNode } from "react";

import type { ChatMessage } from "@/components/redesign/redesign.types";

export const telegramMessages: ChatMessage[] = [
	{
		from: "bot",
		time: "09:14",
		typingMs: 900,
		delayMs: 600,
		body: (
			<>
				<div className="mb-1 font-mono text-[10px] text-sky-300/90">
					[planner]
				</div>
				Decomposed <b>DEV-204</b> into 6 steps. Dispatching to{" "}
				<code className="rounded bg-white/10 px-1">coder</code>,{" "}
				<code className="rounded bg-white/10 px-1">reviewer</code>.
			</>
		),
	},
	{
		from: "you",
		time: "09:15",
		delayMs: 1400,
		body: "/status DEV-204",
		read: true,
	},
	{
		from: "bot",
		time: "09:15",
		typingMs: 1100,
		delayMs: 500,
		body: (
			<>
				<b>DEV-204</b> / Refactor billing audit flow
				<div className="mt-1.5 space-y-0.5 text-[12px]">
					<div>{"\u2713"} Explore - 12 files scanned</div>
					<div>{"\u2713"} Plan - 6 steps</div>
					<div>{"\u25D0"} Implement - 8/8 files, tests running</div>
					<div>{"\u25CB"} Test</div>
				</div>
			</>
		),
	},
	{
		from: "bot",
		time: "09:22",
		typingMs: 1300,
		delayMs: 1600,
		body: (
			<>
				<div className="mb-1 font-mono text-[10px] text-amber-300/90">
					[reviewer]
				</div>
				PR <b>#1294</b> ready / 2 suggestions, 0 blockers.
				<div className="mt-2 flex flex-wrap gap-1.5">
					<TelegramPill>Approve</TelegramPill>
					<TelegramPill>Request changes</TelegramPill>
					<TelegramPill>Open PR {"\u2197"}</TelegramPill>
				</div>
			</>
		),
	},
];

export function TelegramPill({
	children,
}: {
	children: ReactNode;
}): ReactElement {
	return (
		<button
			className="rounded-full border border-white/10 bg-white/10 px-2.5 py-0.5 text-[11px] transition hover:bg-white/15"
			type="button"
		>
			{children}
		</button>
	);
}
