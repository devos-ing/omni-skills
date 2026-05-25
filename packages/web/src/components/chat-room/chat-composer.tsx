"use client";

import { Plus, Send } from "lucide-react";
import {
	type KeyboardEvent,
	type MouseEvent,
	type ReactElement,
	useId,
	useState,
} from "react";

import { cn } from "@/lib/utils";

import {
	getChatCommandSuggestions,
	isChatCommandMenuDraft,
} from "./chat-command-utils";
import type { ChatComposerProps } from "./types/chat-room.types";

export function ChatComposer({
	disabled,
	draft,
	isSending,
	onDraftChange,
	onSelectCommand,
	onSubmit,
}: ChatComposerProps): ReactElement {
	const menuId = useId();
	const [isFocused, setIsFocused] = useState(false);
	const [isCommandMenuDismissed, setIsCommandMenuDismissed] = useState(false);
	const [selectedIndex, setSelectedIndex] = useState(0);
	const commandSuggestions = getChatCommandSuggestions(draft);
	const isCommandDraft = isChatCommandMenuDraft(draft);
	const showCommands = isFocused && isCommandDraft && !isCommandMenuDismissed;
	const activeIndex =
		commandSuggestions.length > 0
			? Math.min(selectedIndex, commandSuggestions.length - 1)
			: 0;
	const activeCommand = commandSuggestions[activeIndex] ?? null;

	function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
		if (showCommands && event.key === "Escape") {
			event.preventDefault();
			setIsCommandMenuDismissed(true);
			return;
		}
		if (showCommands && commandSuggestions.length > 0) {
			if (event.key === "ArrowDown") {
				event.preventDefault();
				setSelectedIndex((index) =>
					wrapIndex(index + 1, commandSuggestions.length),
				);
				return;
			}
			if (event.key === "ArrowUp") {
				event.preventDefault();
				setSelectedIndex((index) =>
					wrapIndex(index - 1, commandSuggestions.length),
				);
				return;
			}
			if (event.key === "Enter") {
				event.preventDefault();
				if (activeCommand) {
					selectCommand(activeCommand.command);
				}
				return;
			}
		}
		if (event.key === "Enter" && !event.shiftKey) {
			event.preventDefault();
			onSubmit();
		}
	}

	function handleDraftChange(value: string): void {
		setIsCommandMenuDismissed(false);
		setSelectedIndex(0);
		onDraftChange(value);
	}

	function selectCommand(command: string): void {
		setIsCommandMenuDismissed(true);
		setSelectedIndex(0);
		onSelectCommand(`${command} `);
	}

	function handleCommandPointerDown(
		event: MouseEvent<HTMLButtonElement>,
	): void {
		event.preventDefault();
	}

	return (
		<div className="border-t border-zinc-900 bg-[#111216] px-4 py-3">
			<div className="relative mx-auto max-w-4xl">
				{showCommands ? (
					<div
						aria-label="Chat commands"
						className="absolute bottom-full mb-2 grid max-h-72 w-full gap-1 overflow-y-auto rounded-md border border-zinc-800 bg-[#17181c] p-2 shadow-2xl"
						id={menuId}
					>
						{commandSuggestions.length > 0 ? (
							commandSuggestions.map((item, index) => {
								const isSelected = index === activeIndex;
								const optionId = commandOptionId(menuId, item.command);
								return (
									<button
										aria-selected={isSelected}
										className={cn(
											"flex min-h-10 items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm text-zinc-300 hover:bg-zinc-800",
											isSelected && "bg-zinc-800 text-zinc-100",
										)}
										id={optionId}
										key={item.command}
										onClick={() => selectCommand(item.command)}
										onMouseDown={handleCommandPointerDown}
										type="button"
									>
										<span className="font-mono text-zinc-100">
											{item.command}
										</span>
										<span className="min-w-0 truncate text-xs text-zinc-500">
											{item.hint}
										</span>
									</button>
								);
							})
						) : (
							<p className="m-0 px-2 py-3 text-sm text-zinc-500">No commands</p>
						)}
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
						aria-activedescendant={
							showCommands && activeCommand
								? commandOptionId(menuId, activeCommand.command)
								: undefined
						}
						aria-controls={showCommands ? menuId : undefined}
						aria-expanded={showCommands}
						aria-haspopup="menu"
						className="max-h-36 min-h-10 resize-none bg-transparent px-1 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
						disabled={disabled}
						onBlur={() => setIsFocused(false)}
						onChange={(event) => handleDraftChange(event.target.value)}
						onFocus={() => setIsFocused(true)}
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

function commandOptionId(menuId: string, command: string): string {
	return `${menuId}-${command.slice(1)}`;
}

function wrapIndex(index: number, length: number): number {
	if (length === 0) {
		return 0;
	}
	return (index + length) % length;
}
