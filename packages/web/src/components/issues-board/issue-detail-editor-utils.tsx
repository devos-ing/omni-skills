import { ExternalLink } from "lucide-react";
import type { ReactElement, ReactNode } from "react";

import type { ProjectBoardTaskRecord, TaskMutationRequest } from "@/lib/api";

import { normalizeDueDate } from "./issues-board-utils";
import type { IssueDetailDraft } from "./issues-board.types";

export function DetailField({
	children,
	label,
}: {
	children: ReactNode;
	label: string;
}): ReactElement {
	return (
		<div className="grid gap-1 rounded-md border border-zinc-800/70 bg-[#141519] px-3 py-2">
			<span className="text-xs font-medium uppercase text-zinc-500">
				{label}
			</span>
			<span className="min-w-0 break-words text-sm text-zinc-200">
				{children}
			</span>
		</div>
	);
}

export function ExternalLinkValue({
	href,
	label = href,
}: {
	href: string;
	label?: string;
}): ReactElement {
	return (
		<a
			className="inline-flex min-w-0 items-center gap-1 text-blue-300 hover:text-blue-200"
			href={href}
			rel="noreferrer"
			target="_blank"
		>
			<span className="truncate">{label}</span>
			<ExternalLink className="shrink-0" size={14} />
		</a>
	);
}

export function createDetailDraft(
	task: ProjectBoardTaskRecord,
): IssueDetailDraft {
	return {
		title: task.title,
		content: task.content,
		priority: String(task.priority),
		status: task.status,
		creatorId: task.creatorId,
		dueDate: toDateInputValue(task.dueDate),
		linkedPr: task.linkedPr ?? "",
	};
}

export function createSaveRequest(
	draft: IssueDetailDraft,
	projectId: string | null,
): { ok: true; value: TaskMutationRequest } | { ok: false; error: string } {
	const priority = Number(draft.priority);
	if (!Number.isInteger(priority)) {
		return { ok: false, error: "Priority must be an integer." };
	}
	if (!draft.title.trim()) {
		return { ok: false, error: "Title is required." };
	}
	if (!draft.creatorId.trim()) {
		return { ok: false, error: "Creator is required." };
	}
	return {
		ok: true,
		value: {
			projectId,
			title: draft.title.trim(),
			content: draft.content.trim(),
			priority,
			status: draft.status,
			creatorId: draft.creatorId.trim(),
			dueDate: normalizeDueDate(draft.dueDate),
			linkedPr: draft.linkedPr.trim() || null,
		},
	};
}

export function formatDateTime(value: string): string {
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) {
		return value;
	}
	return new Intl.DateTimeFormat(undefined, {
		dateStyle: "medium",
		timeStyle: "short",
	}).format(date);
}

function toDateInputValue(value: string | null): string {
	if (!value) {
		return "";
	}
	return value.slice(0, 10);
}
