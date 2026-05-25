"use client";

import { Columns3, Filter, Plus, SlidersHorizontal } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
	ProjectBoardStatusColumn,
	ProjectBoardTaskRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { IssueColumn } from "./issue-board-column";
import { IssuesBoardSkeleton } from "./issues-board-skeleton";
import { getStatusLabel } from "./issues-board-utils";
import { STATUS_ORDER } from "./issues-board.constants";
import type { IssueDragState, IssueTab } from "./types/issues-board.types";

export function BoardHeader({
	activeTab,
	onTabChange,
	onCreateIssue,
}: {
	activeTab: IssueTab;
	onTabChange: (tab: IssueTab) => void;
	onCreateIssue: () => void;
}): ReactElement {
	return (
		<header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-900 bg-[#111216] px-5 py-4">
			<div>
				<p className="mb-1 text-sm text-zinc-500">Roy Lee&apos;s Workspace /</p>
				<h1 className="m-0 text-xl font-semibold">Issues</h1>
			</div>
			<div className="flex flex-wrap items-center gap-2">
				{/* {(["all", "members", "agents"] as const).map((tab) => (
					<button
						className={cn(
							"rounded-md border px-3 py-2 text-sm capitalize",
							activeTab === tab
								? "border-zinc-600 bg-zinc-800 text-white"
								: "border-zinc-800 text-zinc-400 hover:bg-zinc-900",
						)}
						key={tab}
						onClick={() => onTabChange(tab)}
						type="button"
					>
						{tab}
					</button>
				))} */}
				<Button onClick={onCreateIssue} size="sm" type="button">
					<Plus size={16} />
					New Issue
				</Button>
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
			<span>{label}</span>
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
		<div className="flex gap-2 overflow-x-auto border-b border-zinc-900 px-5 py-2">
			{STATUS_ORDER.map((status) => (
				<Button
					className={cn(
						"whitespace-nowrap rounded-md border px-2.5 py-1.5 text-xs",
						visibleStatuses.includes(status)
							? "border-zinc-600 text-zinc-100"
							: "border-zinc-900 text-zinc-500",
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
		<div className="flex flex-wrap items-center gap-3 border-b border-zinc-900 px-5 py-3">
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
	onCreateIssue,
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
	onCreateIssue: (status: string) => void;
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
				<p className="mx-5 mt-3 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
					{dragError}
				</p>
			) : null}
			<div className="flex min-h-0 flex-1 gap-4 overflow-x-auto px-5 py-4">
				{columns.map((column) => (
					<IssueColumn
						column={column}
						dragOverStatus={dragOverStatus}
						dragState={dragState}
						key={column.status}
						onCreateIssue={onCreateIssue}
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
		<div className="grid min-h-[24rem] place-items-center text-sm text-zinc-500">
			{label}
		</div>
	);
}
