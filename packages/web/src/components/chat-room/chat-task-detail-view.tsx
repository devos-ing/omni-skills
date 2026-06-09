"use client";

import type { ReactElement } from "react";

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
import type { ChatTaskDetailViewProps } from "./types/chat-room.types";

export function ChatTaskDetailView({
	taskId,
}: ChatTaskDetailViewProps): ReactElement {
	const taskQuery = useBoardTaskQuery(taskId ?? "", {
		enabled: Boolean(taskId),
		refetchIntervalMs: false,
	});

	return (
		<section
			aria-label="Task details"
			className="min-h-0 overflow-y-auto overflow-x-hidden px-4 py-5 md:px-6"
		>
			<div className="mx-auto grid w-full max-w-5xl min-w-0 gap-5">
				{renderDetailContent(taskQuery, taskId)}
			</div>
		</section>
	);
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
