"use client";

import { ChevronDown, ChevronRight, Terminal } from "lucide-react";
import { type ReactElement, useState } from "react";

import { Typography } from "@/components/ui/typography";

import { summarizeMissionLogLines } from "./chat-mission-log-summary";
import { MissionLogLine } from "./chat-mission-progress-section-parts";
import type { ChatMissionLogLine } from "./types/chat-mission-progress.types";

export function MissionLogPanel({
	lines,
	phaseLabel,
}: {
	lines: ChatMissionLogLine[];
	phaseLabel: string;
}): ReactElement {
	const [expandedGroups, setExpandedGroups] = useState<Set<string>>(
		() => new Set(),
	);
	const groups = summarizeMissionLogLines(lines);
	function toggleGroup(groupId: string): void {
		setExpandedGroups((current) => {
			const next = new Set(current);
			if (next.has(groupId)) {
				next.delete(groupId);
			} else {
				next.add(groupId);
			}
			return next;
		});
	}

	return (
		<section
			className="grid gap-2 rounded-md border border-border bg-surface-inset px-3 py-2"
			data-mission-log-panel="true"
		>
			<div className="flex items-center gap-2 text-muted-foreground">
				<Terminal size={14} />
				<Typography variant="eyebrow">{phaseLabel} output</Typography>
			</div>
			<div className="grid max-h-52 min-h-12 overflow-auto text-xs text-zinc-300">
				{groups.length > 0 ? (
					<div className="divide-y divide-border overflow-hidden rounded-sm border border-border">
						{groups.map((group) => (
							<SummaryGroup
								groupId={group.id}
								isExpanded={expandedGroups.has(group.id)}
								key={group.id}
								label={group.label}
								latestSnippet={group.latestSnippet}
								lineCount={group.lineCount}
								lines={group.lines}
								onToggle={toggleGroup}
							/>
						))}
					</div>
				) : (
					<Typography className="text-muted-foreground" variant="mono">
						No output recorded for this stage.
					</Typography>
				)}
			</div>
		</section>
	);
}

function SummaryGroup({
	groupId,
	isExpanded,
	label,
	latestSnippet,
	lineCount,
	lines,
	onToggle,
}: {
	groupId: string;
	isExpanded: boolean;
	label: string;
	latestSnippet: string;
	lineCount: number;
	lines: ChatMissionLogLine[];
	onToggle: (groupId: string) => void;
}): ReactElement {
	const Icon = isExpanded ? ChevronDown : ChevronRight;
	return (
		<div data-mission-log-summary={groupId}>
			<button
				aria-expanded={isExpanded}
				className="grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2 px-2 py-2 text-left transition hover:bg-surface-active focus:outline-none focus:ring-2 focus:ring-zinc-500"
				onClick={() => onToggle(groupId)}
				type="button"
			>
				<Icon
					aria-hidden="true"
					className="mt-0.5 text-muted-foreground"
					size={14}
				/>
				<span className="grid min-w-0 gap-1">
					<Typography className="truncate" variant="metadata">
						{label}
					</Typography>
					<Typography className="truncate text-muted-foreground" variant="mono">
						{latestSnippet}
					</Typography>
				</span>
				<Typography
					className="whitespace-nowrap text-muted-foreground"
					variant="metadata"
				>
					{formatLineCount(lineCount)}
				</Typography>
			</button>
			{isExpanded ? (
				<div className="grid gap-1 bg-surface-panel px-3 pb-2 pt-1 font-mono">
					{lines.map((line) => (
						<MissionLogLine key={line.id} line={line} />
					))}
				</div>
			) : null}
		</div>
	);
}

function formatLineCount(count: number): string {
	return `${count} ${count === 1 ? "line" : "lines"}`;
}
