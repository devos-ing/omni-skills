"use client";

import { Columns3, Filter, SlidersHorizontal } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Typography } from "@/components/ui/typography";
import type {
	ProjectBoardStatusColumn,
	ProjectBoardTaskRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { IssueColumn } from "./issue-board-column";
import { IssuesBoardSkeleton } from "./issues-board-skeleton";
import { getStatusLabel } from "./issues-board-utils";
import { STATUS_ORDER } from "./issues-board.constants";
import type { IssueDragState } from "./types/issues-board.types";

export function BoardHeader(): ReactElement {
	return (
		<header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface-inset px-5 py-4">
			<div>
				<Typography className="mb-1" variant="description">
					Roy Lee&apos;s Workspace /
				</Typography>
				<Typography variant="pageTitle">Issues</Typography>
			</div>
		</header>
	);
}

export function ToolButton({
	icon,
	label,
	onClick,
}: {
	icon: ReactNode;
	label: string;
	onClick: () => void;
}): ReactElement {
	return (
		<Button onClick={onClick} size="sm" type="button" variant="outline">
			{icon}
			<Typography as="span">{label}</Typography>
		</Button>
	);
}

export function ColumnToggles({
	visibleStatuses,
	onToggle,
}: {
	visibleStatuses: string[];
	onToggle: (status: string) => void;
}): ReactElement {
	return (
		<div className="flex gap-2 overflow-x-auto border-b border-border px-5 py-2">
			{STATUS_ORDER.map((status) => (
				<Button
					className={cn(
						"whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs",
						visibleStatuses.includes(status)
							? "border-zinc-600 text-zinc-100"
							: "border-border text-muted-foreground",
					)}
					key={status}
					onClick={() => onToggle(status)}
					size="sm"
					type="button"
					variant="ghost"
				>
					{getStatusLabel(status)}
				</Button>
			))}
		</div>
	);
}

export function BoardToolbar({
	searchQuery,
	sortNewestFirst,
	taskCount,
	onSearchChange,
	onShowAll,
	onToggleColumns,
	onToggleSort,
}: {
	searchQuery: string;
	sortNewestFirst: boolean;
	taskCount: number;
	onSearchChange: (value: string) => void;
	onShowAll: () => void;
	onToggleColumns: () => void;
	onToggleSort: () => void;
}): ReactElement {
	return (
		<div className="flex flex-wrap items-center gap-3 border-b border-border px-5 py-3">
			<Input
				aria-label="Search issues"
				className="h-9 min-w-52 flex-1"
				onChange={(event) => onSearchChange(event.target.value)}
				placeholder="Search issues"
				value={searchQuery}
			/>
			<ToolButton
				icon={<Filter size={16} />}
				label={`${taskCount} shown`}
				onClick={onShowAll}
			/>
			<ToolButton
				icon={<SlidersHorizontal size={16} />}
				label={sortNewestFirst ? "Newest" : "Oldest"}
				onClick={onToggleSort}
			/>
			<ToolButton
				icon={<Columns3 size={16} />}
				label="Columns"
				onClick={onToggleColumns}
			/>
		</div>
	);
}

export function BoardContent({
	columns,
	dragError,
	dragOverStatus,
	dragState,
	error,
	isLoading,
	onDropStatusEnter,
	onDropStatusLeave,
	onTaskDragEnd,
	onTaskDragStart,
	onTaskDrop,
	onTaskPointerDrop,
	onOpenIssue,
	onOpenIssueMenu,
}: {
	columns: ProjectBoardStatusColumn[];
	dragError: string | null;
	dragOverStatus: string | null;
	dragState: IssueDragState | null;
	error: Error | null;
	isLoading: boolean;
	onDropStatusEnter: (status: string) => void;
	onDropStatusLeave: (status: string) => void;
	onTaskDragEnd: () => void;
	onTaskDragStart: (task: ProjectBoardTaskRecord) => void;
	onTaskDrop: (status: string) => void;
	onTaskPointerDrop: (task: ProjectBoardTaskRecord, status: string) => void;
	onOpenIssue: (task: ProjectBoardTaskRecord) => void;
	onOpenIssueMenu: (
		task: ProjectBoardTaskRecord,
		position: { x: number; y: number },
	) => void;
}): ReactElement {
	if (isLoading) {
		return <IssuesBoardSkeleton />;
	}
	if (error) {
		return <BoardState label={error.message} />;
	}
	if (columns.length === 0) {
		return <BoardState label="No columns selected" />;
	}
	return (
		<div className="flex h-[calc(100dvh-10.5rem)] flex-col">
			{dragError ? (
				<Typography
					className="mx-5 mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2"
					variant="error"
				>
					{dragError}
				</Typography>
			) : null}
			<div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-5 py-4">
				{columns.map((column) => (
					<IssueColumn
						column={column}
						dragOverStatus={dragOverStatus}
						dragState={dragState}
						key={column.status}
						onDropStatusEnter={onDropStatusEnter}
						onDropStatusLeave={onDropStatusLeave}
						onOpenIssue={onOpenIssue}
						onOpenIssueMenu={onOpenIssueMenu}
						onTaskDragEnd={onTaskDragEnd}
						onTaskDragStart={onTaskDragStart}
						onTaskDrop={onTaskDrop}
						onTaskPointerDrop={onTaskPointerDrop}
					/>
				))}
			</div>
		</div>
	);
}

function BoardState({ label }: { label: string }): ReactElement {
	return (
		<div className="grid min-h-[24rem] place-items-center text-sm text-muted-foreground">
			<Typography variant="description">{label}</Typography>
		</div>
	);
}
