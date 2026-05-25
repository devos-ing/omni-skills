"use client";

import { Bot, CheckCircle2, GripVertical } from "lucide-react";
import {
	type DragEvent,
	type MouseEvent,
	type PointerEvent,
	type ReactElement,
	useRef,
} from "react";

import { Button } from "@/components/ui/button";
import type { ProjectBoardTaskRecord } from "@/lib/api";
import { cn } from "@/lib/utils";

import { getPriorityLabel, isAgentTask } from "./issues-board-utils";

interface IssueCardProps {
	isDragged: boolean;
	task: ProjectBoardTaskRecord;
	onDragEnd: () => void;
	onDragStart: (task: ProjectBoardTaskRecord) => void;
	onOpenContextMenu: (
		task: ProjectBoardTaskRecord,
		position: { x: number; y: number },
	) => void;
	onOpenIssue: (task: ProjectBoardTaskRecord) => void;
	onPointerDrop: (task: ProjectBoardTaskRecord, status: string) => void;
}

export function IssueCard({
	isDragged,
	task,
	onDragEnd,
	onDragStart,
	onOpenContextMenu,
	onOpenIssue,
	onPointerDrop,
}: IssueCardProps): ReactElement {
	const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
	const draggedRef = useRef(false);

	function handlePointerDown(event: PointerEvent<HTMLDivElement>): void {
		pointerStartRef.current = { x: event.clientX, y: event.clientY };
	}

	function handlePointerUp(event: PointerEvent<HTMLDivElement>): void {
		const start = pointerStartRef.current;
		pointerStartRef.current = null;
		if (
			!start ||
			Math.hypot(event.clientX - start.x, event.clientY - start.y) < 8
		) {
			return;
		}
		draggedRef.current = true;
		const target = document
			.elementFromPoint(event.clientX, event.clientY)
			?.closest<HTMLElement>("[data-issue-status]");
		const status = target?.dataset.issueStatus;
		if (status) {
			onPointerDrop(task, status);
		}
		window.setTimeout(() => {
			draggedRef.current = false;
		}, 0);
	}

	function handleDragStart(event: DragEvent<HTMLDivElement>): void {
		draggedRef.current = true;
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", task.id);
		onDragStart(task);
	}

	function handleDragEnd(): void {
		window.setTimeout(() => {
			draggedRef.current = false;
		}, 0);
		onDragEnd();
	}

	function handleClick(event: MouseEvent<HTMLButtonElement>): void {
		if (draggedRef.current) {
			event.preventDefault();
			return;
		}
		onOpenIssue(task);
	}

	function handleContextMenu(event: MouseEvent<HTMLDivElement>): void {
		event.preventDefault();
		onOpenContextMenu(task, { x: event.clientX, y: event.clientY });
	}

	return (
		<div
			className={cn(
				"rounded-lg border border-zinc-800 bg-[#1b1c21] p-2.5 text-left shadow-sm transition hover:border-zinc-700",
				isDragged && "opacity-50 ring-2 ring-zinc-600",
			)}
			draggable
			onContextMenu={handleContextMenu}
			onDragEnd={handleDragEnd}
			onDragStart={handleDragStart}
			onPointerDown={handlePointerDown}
			onPointerUp={handlePointerUp}
		>
			<Button
				className="block h-auto w-full p-0 text-left hover:bg-transparent"
				onClick={handleClick}
				type="button"
				variant="ghost"
			>
				<div className="mb-2 flex items-center justify-between gap-2 text-xs font-medium text-zinc-500">
					<span className="truncate">{task.taskKey}</span>
					<GripVertical aria-hidden="true" size={14} />
				</div>
				<h3 className="m-0 line-clamp-2 text-sm font-semibold text-zinc-100">
					{task.title}
				</h3>
				{task.content.trim() ? (
					<p className="mb-2 mt-1.5 line-clamp-2 text-xs leading-5 text-zinc-500">
						{task.content}
					</p>
				) : null}
				<div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
					<span className="rounded-md bg-zinc-800 px-2 py-1">
						{getPriorityLabel(task.priority)}
					</span>
					<span className="rounded-md bg-zinc-800 px-2 py-1">
						{task.assigneeId ?? task.creatorId}
					</span>
					{isAgentTask(task) ? <Bot size={14} /> : <CheckCircle2 size={14} />}
				</div>
			</Button>
		</div>
	);
}
