"use client";

import { Clipboard, FileText, Navigation, Terminal, X } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Typography } from "@/components/ui/typography";
import { cn } from "@/lib/utils";

import {
	buildCommandSearchGroups,
	commandSearchDraftText,
} from "./command-search-dialog-utils";
import type {
	CommandSearchDialogProps,
	CommandSearchResult,
} from "./types/command-search-dialog.types";

export function CommandSearchDialog({
	activeKey,
	boardError,
	commandHistory,
	commandHistoryError,
	isBoardLoading,
	isCommandHistoryLoading,
	isOpen,
	navItems,
	onClose,
	onNavigate,
	onOpenIssue,
	onSelectCommand,
	tasks,
}: CommandSearchDialogProps): ReactElement {
	const [query, setQuery] = useState("");
	const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
	const groups = useMemo(
		() => buildCommandSearchGroups({ commandHistory, navItems, query, tasks }),
		[commandHistory, navItems, query, tasks],
	);
	const hasLoadingState = isBoardLoading || isCommandHistoryLoading;
	const errorMessage =
		boardError?.message ?? commandHistoryError?.message ?? null;

	useEffect(() => {
		if (isOpen) {
			setQuery("");
			setCopiedCommand(null);
		}
	}, [isOpen]);

	function updateQuery(value: string): void {
		setQuery(value);
		setCopiedCommand(null);
	}

	function selectResult(result: CommandSearchResult): void {
		if (result.kind === "chatCommand") {
			onSelectCommand(commandSearchDraftText(result.command));
			onClose();
			return;
		}
		if (result.kind === "navigation") {
			onNavigate(result.navKey);
			onClose();
			return;
		}
		if (result.kind === "issue") {
			onOpenIssue(result.task.id);
			onClose();
			return;
		}
		if (!navigator.clipboard) {
			return;
		}
		void navigator.clipboard
			.writeText(result.command)
			.then(() => setCopiedCommand(result.id))
			.catch(() => setCopiedCommand(null));
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="w-[min(44rem,calc(100vw-1.5rem))] max-w-none gap-0 overflow-hidden bg-surface-panel p-0"
				showCloseButton={false}
			>
				<DialogTitle className="sr-only" id="command-search-title">
					Search
				</DialogTitle>
				<Command shouldFilter={false}>
					<header className="flex items-center border-b border-border">
						<CommandInput
							aria-label="Search commands and issues"
							onValueChange={updateQuery}
							placeholder="Search commands"
							value={query}
						/>
						<Button
							aria-label="Close dialog"
							className="mr-3"
							onClick={onClose}
							size="icon"
							type="button"
							variant="ghost"
						>
							<X size={16} />
						</Button>
					</header>
					<CommandList>
						{errorMessage ? <DialogState label={errorMessage} /> : null}
						{!errorMessage && hasLoadingState && groups.length === 0 ? (
							<DialogState label="Loading results" />
						) : null}
						{!errorMessage && !hasLoadingState ? (
							<CommandEmpty>No results</CommandEmpty>
						) : null}
						{groups.map((group) => (
							<CommandGroup heading={group.label} key={group.id}>
								{group.results.map((result) => (
									<ResultItem
										activeKey={activeKey}
										isCopied={copiedCommand === result.id}
										key={result.id}
										onSelect={() => selectResult(result)}
										result={result}
									/>
								))}
							</CommandGroup>
						))}
					</CommandList>
				</Command>
			</DialogContent>
		</Dialog>
	);
}

function ResultItem({
	activeKey,
	isCopied,
	onSelect,
	result,
}: {
	activeKey: CommandSearchDialogProps["activeKey"];
	isCopied: boolean;
	onSelect: () => void;
	result: CommandSearchResult;
}): ReactElement {
	const Icon = resultIcon(result);
	return (
		<CommandItem onSelect={onSelect} value={result.id}>
			<Icon className="shrink-0 text-muted-foreground" size={17} />
			<Typography as="span" className="min-w-0 flex-1">
				<Typography
					as="span"
					className={cn(
						"block truncate font-medium",
						result.kind === "chatCommand" && "font-mono",
					)}
				>
					{result.label}
				</Typography>
				<Typography className="block truncate" variant="muted">
					{isCopied ? "Copied" : result.detail}
				</Typography>
			</Typography>
			{result.kind === "navigation" && result.navKey === activeKey ? (
				<Typography variant="muted">Current</Typography>
			) : null}
		</CommandItem>
	);
}

function DialogState({ label }: { label: string }): ReactElement {
	return (
		<Typography className="px-3 py-10 text-center" variant="description">
			{label}
		</Typography>
	);
}

function resultIcon(result: CommandSearchResult): typeof Navigation {
	if (result.kind === "chatCommand") {
		return Terminal;
	}
	if (result.kind === "issue") {
		return FileText;
	}
	if (result.kind === "history") {
		return Clipboard;
	}
	return Navigation;
}
