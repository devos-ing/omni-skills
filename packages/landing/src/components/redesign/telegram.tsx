"use client";

import { Bell, Check, CheckCheck, Send } from "lucide-react";
import {
	type ReactElement,
	type RefObject,
	useEffect,
	useRef,
	useState,
} from "react";

import type { ChatMessage } from "@/components/redesign/redesign.types";
import { telegramMessages } from "@/components/redesign/telegram-data";

const loopPauseMs = 4200;

export function Telegram(): ReactElement {
	const [visible, setVisible] = useState(0);
	const [typing, setTyping] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);
	const timeouts = useRef<number[]>([]);

	useEffect(() => {
		function queue(ms: number, callback: () => void): void {
			const id = window.setTimeout(callback, ms);
			timeouts.current.push(id);
		}

		function run(): void {
			setVisible(0);
			setTyping(false);
			let elapsed = 0;
			telegramMessages.forEach((message, index) => {
				elapsed += message.delayMs ?? 800;
				if (message.from === "bot" && message.typingMs) {
					queue(elapsed, () => setTyping(true));
					elapsed += message.typingMs;
					queue(elapsed, () => {
						setTyping(false);
						setVisible(index + 1);
					});
				} else {
					queue(elapsed, () => setVisible(index + 1));
				}
			});
			queue(elapsed + loopPauseMs, run);
		}

		run();
		return () => {
			timeouts.current.forEach(clearTimeout);
			timeouts.current = [];
		};
	}, []);

	useEffect(() => {
		if (scrollRef.current) {
			scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
		}
	});

	return (
		<section
			className="border-border/50 border-y bg-muted/20 py-16 sm:py-24 md:py-32"
			id="inbox"
		>
			<div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-12 lg:gap-12">
				<div className="order-2 lg:order-1 lg:col-span-7">
					<TelegramPhone
						refValue={scrollRef}
						shown={telegramMessages.slice(0, visible)}
						typing={typing}
					/>
				</div>
				<TelegramCopy />
			</div>
		</section>
	);
}

function TelegramPhone({
	refValue,
	shown,
	typing,
}: {
	refValue: RefObject<HTMLDivElement | null>;
	shown: ChatMessage[];
	typing: boolean;
}): ReactElement {
	return (
		<div className="relative mx-auto max-w-md">
			<div className="-inset-6 -z-10 absolute rounded-3xl bg-gradient-to-br from-sky-300/20 via-transparent to-violet-300/20 blur-2xl" />
			<div className="overflow-hidden border-2 border-foreground bg-[#17212b] text-white shadow-retro-pink">
				<div className="flex h-12 items-center gap-3 border-white/10 border-b bg-[#1f2c38] px-4">
					<div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-violet-500 text-[11px]">
						dv
						<span className="-right-0.5 -bottom-0.5 absolute h-2.5 w-2.5 rounded-full border-2 border-[#1f2c38] bg-emerald-400" />
					</div>
					<div className="min-w-0 flex-1">
						<div className="text-sm">devos bot</div>
						<div className="text-[10px] text-white/50 transition-opacity duration-200">
							{typing ? (
								<span className="text-sky-300">typing...</span>
							) : (
								"online / workspace q2-platform"
							)}
						</div>
					</div>
					<Bell className="h-4 w-4 text-white/60" />
				</div>
				<div
					className="h-[360px] space-y-2.5 overflow-y-auto scroll-smooth p-4"
					ref={refValue}
					style={{
						backgroundImage:
							"radial-gradient(circle at 20% 10%, rgba(255,255,255,0.04) 0, transparent 40%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.04) 0, transparent 40%)",
					}}
				>
					{shown.map((message, index) => (
						<div className="tg-pop" key={`${shown.length}-${index}`}>
							<Bubble message={message} />
						</div>
					))}
					{typing ? <TypingBubble /> : null}
				</div>
				<div className="flex items-center gap-2 border-white/10 border-t bg-[#1f2c38] p-2.5">
					<input
						className="flex-1 bg-transparent px-2 text-sm outline-none placeholder:text-white/40"
						placeholder="Message devos bot..."
						readOnly
					/>
					<button
						className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500"
						type="button"
					>
						<Send className="h-3.5 w-3.5" />
					</button>
				</div>
			</div>
		</div>
	);
}

function TypingBubble(): ReactElement {
	return (
		<div className="flex justify-start tg-pop">
			<div className="rounded-2xl rounded-bl-md border border-white/5 bg-[#182533] px-3 py-2.5">
				<div className="flex gap-1">
					<span className="h-1.5 w-1.5 rounded-full bg-white/60 tg-dot" />
					<span className="h-1.5 w-1.5 rounded-full bg-white/60 tg-dot [animation-delay:0.15s]" />
					<span className="h-1.5 w-1.5 rounded-full bg-white/60 tg-dot [animation-delay:0.3s]" />
				</div>
			</div>
		</div>
	);
}

function Bubble({ message }: { message: ChatMessage }): ReactElement {
	const isYou = message.from === "you";

	return (
		<div className={`flex ${isYou ? "justify-end" : "justify-start"}`}>
			<div
				className={`max-w-[85%] rounded-2xl px-3 py-2 text-[13px] leading-snug ${
					isYou
						? "rounded-br-md bg-sky-500 text-white"
						: "rounded-bl-md border border-white/5 bg-[#182533] text-white/90"
				}`}
			>
				<div>{message.body}</div>
				<div
					className={`mt-1 flex items-center justify-end gap-1 text-[10px] ${isYou ? "text-white/70" : "text-white/40"}`}
				>
					{message.time}
					{isYou ? (
						message.read ? (
							<CheckCheck className="h-3 w-3" />
						) : (
							<Check className="h-3 w-3" />
						)
					) : null}
				</div>
			</div>
		</div>
	);
}

function TelegramCopy(): ReactElement {
	return (
		<div className="order-1 lg:order-2 lg:col-span-5">
			<p className="mb-3 text-muted-foreground text-xs uppercase tracking-[0.2em]">
				Telegram inbox
			</p>
			<h2 className="font-pixel text-[clamp(2.5rem,5vw,4rem)] text-[var(--neon-cyan)] uppercase leading-none">
				Your agents
				<br />
				in your pocket.
			</h2>
			<p className="mt-5 max-w-md text-muted-foreground leading-relaxed">
				Check status, approve PRs, and unblock agents from anywhere. devos.ing
				ships with a first-class Telegram bot - every notification is
				actionable.
			</p>
			<ul className="mt-7 space-y-3 text-muted-foreground text-sm">
				{[
					["/status", "Live state of any task or agent"],
					["/inbox", "Everything waiting on your approval"],
					["/pause", "Stop an agent mid-loop, with context preserved"],
					["/resume", "Restart from any checkpoint"],
				].map(([command, description]) => (
					<li className="flex items-start gap-3" key={command}>
						<code className="shrink-0 rounded bg-foreground px-1.5 py-0.5 font-mono text-background text-xs">
							{command}
						</code>
						<span>{description}</span>
					</li>
				))}
			</ul>
		</div>
	);
}
