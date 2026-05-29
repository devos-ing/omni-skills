"use client";

import { X } from "lucide-react";
import { type ReactElement, useSyncExternalStore } from "react";

import { Button } from "@/components/ui/button";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import { Typography } from "@/components/ui/typography";
import type { ProjectBoardTaskRecord } from "@/lib/api";
import { useBoardTaskQuery } from "@/lib/api/queries";

import { IssueActivityPanel } from "../issues-board/issue-activity";
import {
	DetailField,
	ExternalLinkValue,
	formatDateTime,
} from "../issues-board/issue-detail-editor-utils";
import {
	getPriorityLabel,
	getStatusLabel,
} from "../issues-board/issues-board-utils";
import type { ChatTaskDetailPanelProps } from "./types/chat-room.types";

const DESKTOP_QUERY = "(min-width: 768px)";

export function ChatTaskDetailPanel({
	isOpen,
	taskId,
	onClose,
}: ChatTaskDetailPanelProps): ReactElement | null {
	const isDesktop = useSyncExternalStore(
		subscribeDesktopQuery,
		getDesktopSnapshot,
		getDesktopServerSnapshot,
	);
	const shouldShow = isOpen && Boolean(taskId);
	const taskQuery = useBoardTaskQuery(taskId ?? "", {
		enabled: shouldShow,
		refetchIntervalMs: false,
	});

	if (!shouldShow) {
		return null;
	}

	if (isDesktop) {
		return (
			<aside
				aria-label="Task details"
				className="grid min-h-0 w-[26rem] min-w-0 shrink-0 grid-rows-[auto_minmax(0,1fr)] overflow-x-hidden border-l border-border bg-surface-inset text-zinc-100"
			>
				{/* <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
					<Typography variant="dialogTitle">Task details</Typography>
					<Button
						aria-label="Close task details"
						onClick={onClose}
						size="icon"
						type="button"
						variant="ghost"
					>
						<X size={16} />
					</Button>
				</div> */}
				<div className="min-h-0 min-w-0 overflow-x-hidden overflow-y-auto px-5 py-5">
					{renderDetailContent(taskQuery, taskId)}
				</div>
			</aside>
		);
	}

	return (
		<Sheet open={shouldShow} onOpenChange={handleOpenChange}>
			<SheetContent aria-describedby={undefined}>
				<SheetHeader className="border-b border-border px-5 py-4 pr-12">
					<SheetTitle>Task details</SheetTitle>
				</SheetHeader>
				<div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
					{renderDetailContent(taskQuery, taskId)}
				</div>
			</SheetContent>
		</Sheet>
	);

	function handleOpenChange(open: boolean): void {
		if (!open) {
			onClose();
		}
	}
}

function renderDetailContent(
	taskQuery: ReturnType<typeof useBoardTaskQuery>,
	taskId: string | null,
): ReactElement {
	if (!taskId) {
		return <DetailState label="Task not found" />;
	}
	if (taskQuery.isLoading) {
		return <DetailState label="Loading task" />;
	}
	if (taskQuery.error) {
		return <DetailState label={taskQuery.error.message} />;
	}
	if (!taskQuery.data) {
		return <DetailState label="Task not found" />;
	}
	return (
		<div className="grid min-w-0 gap-5 overflow-x-hidden">
			<ReadOnlyTaskDetails task={taskQuery.data} />
			<IssueActivityPanel task={taskQuery.data} />
		</div>
	);
}

function ReadOnlyTaskDetails({
	task,
}: {
	task: ProjectBoardTaskRecord;
}): ReactElement {
	return (
		<article className="grid min-w-0 gap-5">
			<section className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-5">
				<div className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground">
					<Typography variant="description">{task.taskKey}</Typography>
					<Typography variant="description">/</Typography>
					<Typography className="break-all" variant="description">
						{task.id}
					</Typography>
				</div>
				<div className="grid min-w-0 gap-3">
					<Typography className="break-words text-lg" variant="sectionTitle">
						{task.title}
					</Typography>
					<Typography className="whitespace-pre-wrap break-words leading-6">
						{task.content || "No description"}
					</Typography>
				</div>
			</section>
			<section className="grid min-w-0 gap-3 rounded-lg border border-border bg-card p-5">
				<DetailField label="Status">{getStatusLabel(task.status)}</DetailField>
				<DetailField label="Priority">
					{getPriorityLabel(task.priority)}
				</DetailField>
				<DetailField label="Creator">{task.creatorId}</DetailField>
				<DetailField label="Due date">
					{task.dueDate ?? "No due date"}
				</DetailField>
				<DetailField label="Project">
					{task.projectId ?? "No project"}
				</DetailField>
				<DetailField label="Linked PR">
					{task.linkedPr ? (
						<ExternalLinkValue href={task.linkedPr} />
					) : (
						"No linked pull request"
					)}
				</DetailField>
				<DetailField label="Created">
					{formatDateTime(task.createdAt)}
				</DetailField>
				<DetailField label="Updated">
					{formatDateTime(task.updatedAt)}
				</DetailField>
			</section>
		</article>
	);
}

function DetailState({ label }: { label: string }): ReactElement {
	return (
		<div className="grid min-h-64 place-items-center rounded-lg border border-border bg-card text-sm text-muted-foreground">
			<Typography variant="description">{label}</Typography>
		</div>
	);
}

function subscribeDesktopQuery(onStoreChange: () => void): () => void {
	const query = window.matchMedia(DESKTOP_QUERY);
	query.addEventListener("change", onStoreChange);
	return () => query.removeEventListener("change", onStoreChange);
}

function getDesktopSnapshot(): boolean {
	return window.matchMedia(DESKTOP_QUERY).matches;
}

function getDesktopServerSnapshot(): boolean {
	return true;
}
