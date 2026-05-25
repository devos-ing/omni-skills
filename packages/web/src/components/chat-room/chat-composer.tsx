"use client";

import { Plus, Send } from "lucide-react";
import type { KeyboardEvent, ReactElement } from "react";

import { CHAT_COMMANDS } from "./chat-command-utils";
import type { ChatComposerProps } from "./types/chat-room.types";

export function ChatComposer({
	disabled,
	draft,
	isSending,
	onDraftChange,
	onSelectCommand,
	onSubmit,
}: ChatComposerProps): ReactElement {
	const showCommands = draft.startsWith("/");

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			onSubmit();
		}
	}

	return (
		<div className="border-t border-zinc-900 bg-[#111216] px-4 py-3">
			<div className="relative mx-auto max-w-4xl">
				{showCommands ? (
					<div className="absolute bottom-full mb-2 grid w-full gap-1 rounded-md border border-zinc-800 bg-[#17181c] p-2 shadow-2xl">
						{CHAT_COMMANDS.map((item) => (
							<button
								className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800"
								key={item.command}
								onClick={() => onSelectCommand(`${item.command} `)}
								type="button"
							>
								<span className="font-mono text-zinc-100">{item.command}</span>
								<span className="truncate text-xs text-zinc-500">
									{item.hint}
								</span>
							</button>
						))}
					</div>
				) : null}
				<div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 rounded-md border border-zinc-800 bg-[#17181c] p-2">
					<button
						aria-label="Add"
						className="issue-icon-button h-9 w-9"
						disabled={disabled}
						type="button"
					>
						<Plus size={16} />
					</button>
					<textarea
						className="max-h-36 min-h-10 resize-none bg-transparent px-1 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
						disabled={disabled}
						onChange={(event) => onDraftChange(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Message or /command"
						value={draft}
					/>
					<button
						aria-label="Send"
						className="issue-icon-button h-9 w-9 text-zinc-300"
						disabled={disabled || isSending || draft.trim().length === 0}
						onClick={onSubmit}
						type="button"
					>
						<Send size={16} />
					</button>
				</div>
			</div>
		</div>
	);
}
