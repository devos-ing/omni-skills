"use client";

import { Plus, Send } from "lucide-react";
import {
	type KeyboardEvent,
	type MouseEvent,
	type ReactElement,
	useId,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import { ChatCommandMenu, commandOptionId } from "./chat-command-menu";
import {
	getChatCommandSuggestions,
	isChatCommandMenuDraft,
} from "./chat-command-utils";
import { ChatComposerTextarea } from "./chat-composer-textarea";
import type { ChatComposerProps } from "./types/chat-room.types";

export function ChatComposer({
	disabled,
	draft,
	isSending,
	placeholder = "Message or /command",
	presentation = "compact",
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
	const isHero = presentation === "hero";
	const activeCommandId = activeCommand
		? commandOptionId(menuId, activeCommand.command)
		: undefined;

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
		<div className={cn(isHero ? "px-0 py-0" : "px-4 py-3")}>
			<div
				className={cn("relative mx-auto", isHero ? "max-w-5xl" : "max-w-4xl")}
			>
				{showCommands ? (
					<ChatCommandMenu
						activeIndex={activeIndex}
						menuId={menuId}
						suggestions={commandSuggestions}
						onPointerDown={handleCommandPointerDown}
						onSelectCommand={selectCommand}
					/>
				) : null}
				<div
					className={cn(
						"border border-border bg-surface-input",
						isHero
							? "grid gap-7 rounded-[1.65rem] px-5 py-4"
							: "grid grid-cols-[auto_minmax(0,1fr)_auto] items-end gap-2 rounded-md p-2",
					)}
				>
					{isHero ? (
						<>
							<ChatComposerTextarea
								activeCommandId={activeCommandId}
								className="min-h-0 resize-none overflow-y-hidden border-0 bg-transparent px-1 py-1 text-base leading-7 focus-visible:border-transparent focus-visible:ring-0"
								disabled={disabled}
								draft={draft}
								menuId={menuId}
								onBlur={() => setIsFocused(false)}
								onChange={handleDraftChange}
								onFocus={() => setIsFocused(true)}
								onKeyDown={handleKeyDown}
								placeholder={placeholder}
								showCommands={showCommands}
							/>
							<div className="flex min-w-0 items-center justify-between gap-3">
								<Button
									aria-label="Add"
									disabled={disabled}
									size="iconLg"
									type="button"
									variant="ghost"
								>
									<Plus size={18} />
								</Button>
								<div className="flex min-w-0 items-center gap-2">
									<Typography
										className="hidden truncate sm:inline"
										variant="description"
									>
										devos agent
									</Typography>
									<Button
										aria-label="Send"
										className="text-zinc-300"
										disabled={
											disabled || isSending || draft.trim().length === 0
										}
										onClick={onSubmit}
										size="iconLg"
										type="button"
										variant="ghost"
									>
										<Send size={17} />
									</Button>
								</div>
							</div>
						</>
					) : (
						<>
							<Button
								aria-label="Add"
								disabled={disabled}
								size="iconLg"
								type="button"
								variant="ghost"
							>
								<Plus size={16} />
							</Button>
							<ChatComposerTextarea
								activeCommandId={activeCommandId}
								className="min-h-0 resize-none overflow-y-hidden border-0 bg-transparent px-1 py-2 focus-visible:border-transparent focus-visible:ring-0"
								disabled={disabled}
								draft={draft}
								menuId={menuId}
								onBlur={() => setIsFocused(false)}
								onChange={handleDraftChange}
								onFocus={() => setIsFocused(true)}
								onKeyDown={handleKeyDown}
								placeholder={placeholder}
								showCommands={showCommands}
							/>
							<Button
								aria-label="Send"
								className="text-zinc-300"
								disabled={disabled || isSending || draft.trim().length === 0}
								onClick={onSubmit}
								size="iconLg"
								type="button"
								variant="ghost"
							>
								<Send size={16} />
							</Button>
						</>
					)}
				</div>
			</div>
		</div>
	);
}

function wrapIndex(index: number, length: number): number {
	if (length === 0) {
		return 0;
	}
	return (index + length) % length;
}
