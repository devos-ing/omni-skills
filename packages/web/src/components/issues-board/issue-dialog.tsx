"use client";

import { Trash2, X } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";

import type { ProjectBoardTaskRecord, TaskMutationRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
	createDraftFromTask,
	createEmptyDraft,
	getStatusLabel,
	normalizeDueDate,
} from "./issues-board-utils";
import { DEFAULT_CREATOR_ID, STATUS_ORDER } from "./issues-board.constants";
import type {
	IssueDialogMode,
	IssueDraft,
	IssuePriority,
} from "./issues-board.types";
import { PriorityDropdown } from "./priority-dropdown";

interface IssueDialogProps {
	mode: IssueDialogMode;
	defaultStatus: string;
	projectId?: string | null;
	task?: ProjectBoardTaskRecord;
	isSaving: boolean;
	isDeleting: boolean;
	errorMessage: string | null;
	onClose: () => void;
	onSubmit: (draft: TaskMutationRequest) => Promise<void>;
	onDelete?: () => Promise<void>;
}

export function IssueDialog({
	mode,
	defaultStatus,
	projectId,
	task,
	isSaving,
	isDeleting,
	errorMessage,
	onClose,
	onSubmit,
	onDelete,
}: IssueDialogProps): ReactElement {
	const [draft, setDraft] = useState<IssueDraft>(() =>
		task ? createDraftFromTask(task) : createEmptyDraft(defaultStatus),
	);
	const [localError, setLocalError] = useState<string | null>(null);
	const title = mode === "create" ? "New Issue" : (task?.id ?? "Issue");

	useEffect(() => {
		setDraft(
			task ? createDraftFromTask(task) : createEmptyDraft(defaultStatus),
		);
		setLocalError(null);
	}, [defaultStatus, task]);

	const canSubmit = useMemo(() => {
		return draft.title.trim().length > 0;
	}, [draft.title]);

	async function handleSubmit(): Promise<void> {
		setLocalError(null);
		const priority = Number(draft.priority);
		if (!Number.isInteger(priority)) {
			setLocalError("Priority must be an integer.");
			return;
		}
		if (!canSubmit) {
			setLocalError("Title is required.");
			return;
		}
		await onSubmit({
			projectId: projectId || undefined,
			title: draft.title.trim(),
			content: draft.content.trim(),
			priority,
			status: draft.status,
			creatorId: draft.creatorId.trim() || DEFAULT_CREATOR_ID,
			dueDate: normalizeDueDate(draft.dueDate),
			linkedPr: draft.linkedPr.trim() || null,
		});
	}

	function updatePriority(priority: IssuePriority): void {
		setDraft({ ...draft, priority: String(priority) });
	}

	return (
		<div
			className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4"
			role="presentation"
		>
			<dialog
				aria-labelledby="issue-dialog-title"
				aria-modal="true"
				className="grid max-h-[100dvh] w-full max-w-2xl gap-4 overflow-auto rounded-lg border border-zinc-800 bg-[#18191d] p-5 text-zinc-100 shadow-2xl"
				open
			>
				<header className="flex items-center justify-between gap-4">
					<div>
						<p className="mb-1 text-xs font-medium uppercase text-zinc-500">
							{mode === "create" ? getStatusLabel(defaultStatus) : "Details"}
						</p>
						<h2 className="m-0 text-lg font-semibold" id="issue-dialog-title">
							{title}
						</h2>
					</div>
					<button
						aria-label="Close dialog"
						className="grid h-9 w-9 place-items-center rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800"
						onClick={onClose}
						type="button"
					>
						<X size={17} />
					</button>
				</header>
				<div className="grid gap-3">
					<Field label="Title">
						<input
							className="issue-input"
							onChange={(event) =>
								setDraft({ ...draft, title: event.target.value })
							}
							value={draft.title}
						/>
					</Field>
					<Field label="Description">
						<textarea
							className="issue-input min-h-28 resize-y"
							onChange={(event) =>
								setDraft({ ...draft, content: event.target.value })
							}
							value={draft.content}
						/>
					</Field>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Status">
							<select
								className="issue-input"
								onChange={(event) =>
									setDraft({ ...draft, status: event.target.value })
								}
								value={draft.status}
							>
								{STATUS_ORDER.map((status) => (
									<option key={status} value={status}>
										{getStatusLabel(status)}
									</option>
								))}
							</select>
						</Field>
						<Field label="Priority">
							<PriorityDropdown
								value={draft.priority}
								onChange={updatePriority}
							/>
						</Field>
						<Field label="Creator">
							<input
								className="issue-input"
								onChange={(event) =>
									setDraft({ ...draft, creatorId: event.target.value })
								}
								value={draft.creatorId}
							/>
						</Field>
						<Field label="Due date">
							<input
								className="issue-input"
								onChange={(event) =>
									setDraft({ ...draft, dueDate: event.target.value })
								}
								type="date"
								value={draft.dueDate}
							/>
						</Field>
					</div>
					<Field label="Linked PR">
						<input
							className="issue-input"
							onChange={(event) =>
								setDraft({ ...draft, linkedPr: event.target.value })
							}
							placeholder="https://github.com/org/repo/pull/123"
							value={draft.linkedPr}
						/>
					</Field>
				</div>
				{localError || errorMessage ? (
					<p className="m-0 rounded-md border border-red-900/60 bg-red-950/40 px-3 py-2 text-sm text-red-200">
						{localError ?? errorMessage}
					</p>
				) : null}
				<footer className="flex flex-wrap items-center justify-between gap-3">
					{onDelete ? (
						<button
							className="inline-flex items-center gap-2 rounded-md border border-red-900/70 px-3 py-2 text-sm text-red-200 hover:bg-red-950/50"
							disabled={isDeleting}
							onClick={onDelete}
							type="button"
						>
							<Trash2 size={15} />
							{isDeleting ? "Deleting..." : "Delete"}
						</button>
					) : (
						<span />
					)}
					<div className="flex items-center gap-2">
						<button
							className="issue-secondary-button"
							onClick={onClose}
							type="button"
						>
							Cancel
						</button>
						<button
							className={cn("issue-primary-button", !canSubmit && "opacity-50")}
							disabled={!canSubmit || isSaving}
							onClick={handleSubmit}
							type="button"
						>
							{isSaving ? "Saving..." : "Save"}
						</button>
					</div>
				</footer>
			</dialog>
		</div>
	);
}

function Field({
	label,
	children,
}: {
	label: string;
	children: ReactElement;
}): ReactElement {
	return (
		<div className="grid gap-1.5 text-sm text-zinc-400">
			<span>{label}</span>
			{children}
		</div>
	);
}
