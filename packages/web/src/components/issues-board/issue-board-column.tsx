"use client";

import { Circle, MoreHorizontal, Plus } from "lucide-react";
import type { DragEvent, ReactElement } from "react";

import { Button } from "@/components/ui/button";
import type {
	ProjectBoardStatusColumn,
	ProjectBoardTaskRecord,
} from "@/lib/api";
import { cn } from "@/lib/utils";

import { IssueCard } from "./issue-card";
import { getStatusLabel } from "./issues-board-utils";
import { STATUS_PRESENTATION } from "./issues-board.constants";
import type { IssueDragState } from "./types/issues-board.types";

interface IssueColumnProps {
	column: ProjectBoardStatusColumn;
	dragOverStatus: string | null;
	dragState: IssueDragState | null;
	onCreateIssue: (status: string) => void;
	onDropStatusEnter: (status: string) => void;
	onDropStatusLeave: (status: string) => void;
	onOpenIssue: (task: ProjectBoardTaskRecord) => void;
	onOpenIssueMenu: (
		task: ProjectBoardTaskRecord,
		position: { x: number; y: number },
	) => void;
	onTaskDragEnd: () => void;
	onTaskDragStart: (task: ProjectBoardTaskRecord) => void;
	onTaskDrop: (status: string) => void;
	onTaskPointerDrop: (task: ProjectBoardTaskRecord, status: string) => void;
}

export function IssueColumn({
	column,
	dragOverStatus,
	dragState,
	onCreateIssue,
	onDropStatusEnter,
	onDropStatusLeave,
	onOpenIssue,
	onOpenIssueMenu,
	onTaskDragEnd,
	onTaskDragStart,
	onTaskDrop,
	onTaskPointerDrop,
}: IssueColumnProps): ReactElement {
	const tone = STATUS_PRESENTATION[column.status]?.tone ?? "bg-[#17181c]";
	const canDrop = Boolean(dragState && dragState.status !== column.status);
	const isDropTarget = canDrop && dragOverStatus === column.status;

	function handleDragEnter(event: DragEvent<HTMLElement>): void {
		if (!canDrop) {
			return;
		}
		event.preventDefault();
		onDropStatusEnter(column.status);
	}

	function handleDragOver(event: DragEvent<HTMLElement>): void {
		if (!canDrop) {
			return;
		}
		event.preventDefault();
		event.dataTransfer.dropEffect = "move";
	}

	function handleDrop(event: DragEvent<HTMLElement>): void {
		event.preventDefault();
		if (!canDrop) {
			return;
		}
		onTaskDrop(column.status);
	}

	function handleDragLeave(event: DragEvent<HTMLElement>): void {
		const nextTarget = event.relatedTarget;
		if (
			nextTarget instanceof Node &&
			event.currentTarget.contains(nextTarget)
		) {
			return;
		}
		onDropStatusLeave(column.status);
	}

	return (
		<section
			data-issue-status={column.status}
			className={cn(
				"flex h-full w-[18rem] shrink-0 flex-col rounded-lg border p-2.5 transition",
				tone,
				isDropTarget && "border-zinc-400 ring-2 ring-zinc-500/50",
			)}
			onDragEnter={handleDragEnter}
			onDragLeave={handleDragLeave}
			onDragOver={handleDragOver}
			onDrop={handleDrop}
		>
			<header className="mb-4 flex items-center justify-between gap-3">
				<div className="flex items-center gap-2">
					<Circle className="text-zinc-500" size={15} />
					<h2 className="m-0 text-sm font-semibold">
						{getStatusLabel(column.status)}
					</h2>
					<span className="text-sm text-zinc-500">{column.tasks.length}</span>
				</div>
				<div className="flex items-center gap-1">
					<Button size="icon" type="button" variant="ghost">
						<MoreHorizontal size={16} />
					</Button>
					<Button
						aria-label={`Add ${getStatusLabel(column.status)} issue`}
						onClick={() => onCreateIssue(column.status)}
						size="icon"
						type="button"
						variant="ghost"
					>
						<Plus size={16} />
					</Button>
				</div>
			</header>
			<div className="grid content-start gap-3 overflow-y-auto pr-1">
				{column.tasks.length === 0 ? (
					<p className="mt-16 text-center text-sm text-zinc-500">No issues</p>
				) : (
					column.tasks.map((task) => (
						<IssueCard
							isDragged={dragState?.taskId === task.id}
							key={task.id}
							onDragEnd={onTaskDragEnd}
							onDragStart={onTaskDragStart}
							onOpenContextMenu={onOpenIssueMenu}
							onOpenIssue={onOpenIssue}
							onPointerDrop={onTaskPointerDrop}
							task={task}
						/>
					))
				)}
			</div>
		</section>
	);
}
