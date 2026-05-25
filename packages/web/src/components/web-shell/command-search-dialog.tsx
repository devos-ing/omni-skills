"use client";

import { Clipboard, FileText, Navigation, Plus, Search, X } from "lucide-react";
import {
	type KeyboardEvent,
	type ReactElement,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

import { buildCommandSearchGroups } from "./command-search-dialog-utils";
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
	onNewIssue,
	onOpenIssue,
	tasks,
}: CommandSearchDialogProps): ReactElement {
	const inputRef = useRef<HTMLInputElement>(null);
	const [query, setQuery] = useState("");
	const [selectedIndex, setSelectedIndex] = useState(0);
	const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
	const groups = useMemo(
		() => buildCommandSearchGroups({ commandHistory, navItems, query, tasks }),
		[commandHistory, navItems, query, tasks],
	);
	const results = groups.flatMap((group) => group.results);
	const hasLoadingState = isBoardLoading || isCommandHistoryLoading;
	const errorMessage =
		boardError?.message ?? commandHistoryError?.message ?? null;

	useEffect(() => {
		if (isOpen) {
			setQuery("");
			setSelectedIndex(0);
			setCopiedCommand(null);
			window.setTimeout(() => inputRef.current?.focus(), 0);
		}
	}, [isOpen]);

	function updateQuery(value: string): void {
		setQuery(value);
		setSelectedIndex(0);
		setCopiedCommand(null);
	}

	function selectResult(result: CommandSearchResult): void {
		if (result.kind === "navigation") {
			onNavigate(result.navKey);
			onClose();
			return;
		}
		if (result.kind === "action") {
			onNewIssue();
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

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
		if (event.key === "ArrowDown") {
			event.preventDefault();
			setSelectedIndex((index) => wrapIndex(index + 1, results.length));
		}
		if (event.key === "ArrowUp") {
			event.preventDefault();
			setSelectedIndex((index) => wrapIndex(index - 1, results.length));
		}
		if (event.key === "Enter" && results[selectedIndex]) {
			event.preventDefault();
			selectResult(results[selectedIndex]);
		}
	}

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="w-[min(44rem,calc(100vw-1.5rem))] max-w-none gap-0 overflow-hidden bg-[#15161a] p-0"
				showCloseButton={false}
			>
				<header className="flex items-center gap-3 border-b border-zinc-900 px-4 py-3">
					<Search className="text-zinc-500" size={18} />
					<Input
						aria-label="Search commands and issues"
						className="min-w-0 flex-1 border-0 bg-transparent px-0 focus-visible:border-transparent focus-visible:ring-0"
						onChange={(event) => updateQuery(event.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Search issues and commands"
						ref={inputRef}
						value={query}
					/>
					<Button
						aria-label="Close dialog"
						onClick={onClose}
						size="icon"
						type="button"
						variant="ghost"
					>
						<X size={16} />
					</Button>
				</header>
				<DialogTitle className="sr-only" id="command-search-title">
					Search
				</DialogTitle>
				<div className="max-h-[min(34rem,calc(100dvh-7rem))] overflow-y-auto p-2">
					{errorMessage ? <DialogState label={errorMessage} /> : null}
					{!errorMessage && hasLoadingState && results.length === 0 ? (
						<DialogState label="Loading results" />
					) : null}
					{!errorMessage && !hasLoadingState && results.length === 0 ? (
						<DialogState label="No results" />
					) : null}
					{groups.map((group) => (
						<section className="py-2" key={group.id}>
							<p className="mb-1 px-2 text-xs font-semibold text-zinc-500">
								{group.label}
							</p>
							<div className="grid gap-1">
								{group.results.map((result) => {
									const index = results.indexOf(result);
									return (
										<ResultButton
											activeKey={activeKey}
											isCopied={copiedCommand === result.id}
											isSelected={index === selectedIndex}
											key={result.id}
											onSelect={() => selectResult(result)}
											result={result}
										/>
									);
								})}
							</div>
						</section>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

function ResultButton({
	activeKey,
	isCopied,
	isSelected,
	onSelect,
	result,
}: {
	activeKey: CommandSearchDialogProps["activeKey"];
	isCopied: boolean;
	isSelected: boolean;
	onSelect: () => void;
	result: CommandSearchResult;
}): ReactElement {
	const Icon = resultIcon(result);
	return (
		<Button
			className={cn(
				"h-auto min-h-12 w-full justify-start gap-3 rounded-md px-3 py-2 text-left text-sm",
				isSelected ? "bg-zinc-800 text-zinc-100" : "text-zinc-300",
			)}
			onClick={onSelect}
			type="button"
			variant="ghost"
		>
			<Icon className="shrink-0 text-zinc-500" size={17} />
			<span className="min-w-0 flex-1">
				<span className="block truncate font-medium">{result.label}</span>
				<span className="block truncate text-xs text-zinc-500">
					{isCopied ? "Copied" : result.detail}
				</span>
			</span>
			{result.kind === "navigation" && result.navKey === activeKey ? (
				<span className="text-xs text-zinc-500">Current</span>
			) : null}
		</Button>
	);
}

function DialogState({ label }: { label: string }): ReactElement {
	return (
		<p className="px-3 py-10 text-center text-sm text-zinc-500">{label}</p>
	);
}

function resultIcon(result: CommandSearchResult): typeof Navigation {
	if (result.kind === "issue") {
		return FileText;
	}
	if (result.kind === "history") {
		return Clipboard;
	}
	if (result.kind === "action") {
		return Plus;
	}
	return Navigation;
}

function wrapIndex(index: number, length: number): number {
	if (length === 0) {
		return 0;
	}
	return (index + length) % length;
}
