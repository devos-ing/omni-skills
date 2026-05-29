"use client";

import { Archive, Loader2, Pin, PinOff } from "lucide-react";
import type { ReactElement } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";
import type { ChatRoomSessionRowProps } from "./types/chat-room-sidebar.types";

export function ChatRoomSessionRow({
	activeSessionId,
	isPinned,
	isRunning,
	session,
	onArchiveSession,
	onPinSession,
	onSelectSession,
	onUnpinSession,
}: ChatRoomSessionRowProps): ReactElement {
	const pinLabel = isPinned ? `Unpin ${session.title}` : `Pin ${session.title}`;

	function handlePinClick(): void {
		if (isPinned) {
			onUnpinSession(session.id);
			return;
		}
		onPinSession(session.id);
	}

	return (
		<div
			className={cn(
				"group grid min-w-0 grid-cols-[minmax(0,1fr)_2rem_2rem] gap-0 rounded-md border border-transparent hover:bg-surface-active hover:text-zinc-200",
				isRunning && "border-emerald-400/30 bg-emerald-500/5",
				session.id === activeSessionId
					? "bg-[#111110] text-zinc-100"
					: "text-zinc-400",
			)}
		>
			<Button
				className="h-auto min-w-0 justify-start gap-2 pl-2 pr-0 py-2 text-left text-sm"
				onClick={() => onSelectSession(session.id)}
				type="button"
				variant="ghost"
			>
				{isRunning ? (
					<span
						className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-emerald-300"
						title="AI model running"
					>
						<Loader2 aria-hidden="true" className="animate-spin" size={14} />
						<span className="sr-only">AI model running</span>
					</span>
				) : null}
				<span className="min-w-0 flex-1">
					<Typography as="span" className="block truncate">
						{session.title}
					</Typography>
				</span>
			</Button>
			<Button
				aria-label={pinLabel}
				aria-pressed={isPinned}
				className={cn(
					"transition-opacity group-hover:opacity-100 group-focus-within:opacity-100",
					isPinned ? "opacity-100" : "opacity-0",
				)}
				onClick={handlePinClick}
				size="icon"
				title={isPinned ? "Unpin session" : "Pin session"}
				type="button"
				variant="ghost"
			>
				{isPinned ? <PinOff size={14} /> : <Pin size={14} />}
			</Button>
			<Dialog>
				<DialogTrigger asChild>
					<Button
						aria-label={`Archive ${session.title}`}
						className="opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
						size="icon"
						title="Archive session"
						type="button"
						variant="ghost"
					>
						<Archive size={14} />
					</Button>
				</DialogTrigger>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Archive session?</DialogTitle>
						<DialogDescription>
							Archive "{session.title}" and remove it from the sidebar.
						</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<DialogClose asChild>
							<Button type="button" variant="outline">
								Cancel
							</Button>
						</DialogClose>
						<DialogClose asChild>
							<Button
								onClick={() => onArchiveSession(session.id)}
								type="button"
								variant="destructive"
							>
								Archive
							</Button>
						</DialogClose>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
