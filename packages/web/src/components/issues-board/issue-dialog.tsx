"use client";

import { Trash2, X } from "lucide-react";
import { type ReactElement, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import type { ProjectBoardTaskRecord, TaskMutationRequest } from "@/lib/api";
import { cn } from "@/lib/utils";

import {
	createDraftFromTask,
	createEmptyDraft,
	getStatusLabel,
	normalizeDueDate,
} from "./issues-board-utils";
import { DEFAULT_CREATOR_ID, STATUS_ORDER } from "./issues-board.constants";
import { PriorityDropdown } from "./priority-dropdown";
import type {
	IssueDialogMode,
	IssueDraft,
	IssuePriority,
} from "./types/issues-board.types";

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
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent
				className="max-h-[100dvh] max-w-2xl overflow-auto p-5"
				showCloseButton={false}
			>
				<DialogHeader className="flex-row items-center justify-between gap-4 space-y-0 text-left">
					<div>
						<p className="mb-1 text-xs font-medium uppercase text-zinc-500">
							{mode === "create" ? getStatusLabel(defaultStatus) : "Details"}
						</p>
						<DialogTitle>{title}</DialogTitle>
					</div>
					<Button
						aria-label="Close dialog"
						onClick={onClose}
						size="iconLg"
						type="button"
						variant="secondary"
					>
						<X size={17} />
					</Button>
				</DialogHeader>
				<div className="grid gap-3">
					<Field label="Title">
						<Input
							onChange={(event) =>
								setDraft({ ...draft, title: event.target.value })
							}
							value={draft.title}
						/>
					</Field>
					<Field label="Description">
						<Textarea
							className="min-h-28 resize-y"
							onChange={(event) =>
								setDraft({ ...draft, content: event.target.value })
							}
							value={draft.content}
						/>
					</Field>
					<div className="grid gap-3 sm:grid-cols-2">
						<Field label="Status">
							<NativeSelect
								onChange={(event) =>
									setDraft({ ...draft, status: event.target.value })
								}
								value={draft.status}
							>
								{STATUS_ORDER.map((status) => (
									<NativeSelectOption key={status} value={status}>
										{getStatusLabel(status)}
									</NativeSelectOption>
								))}
							</NativeSelect>
						</Field>
						<Field label="Priority">
							<PriorityDropdown
								value={draft.priority}
								onChange={updatePriority}
							/>
						</Field>
						<Field label="Creator">
							<Input
								onChange={(event) =>
									setDraft({ ...draft, creatorId: event.target.value })
								}
								value={draft.creatorId}
							/>
						</Field>
						<Field label="Due date">
							<Input
								onChange={(event) =>
									setDraft({ ...draft, dueDate: event.target.value })
								}
								type="date"
								value={draft.dueDate}
							/>
						</Field>
					</div>
					<Field label="Linked PR">
						<Input
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
						<Button
							disabled={isDeleting}
							onClick={onDelete}
							type="button"
							variant="destructive"
						>
							<Trash2 size={15} />
							{isDeleting ? "Deleting..." : "Delete"}
						</Button>
					) : (
						<span />
					)}
					<div className="flex items-center gap-2">
						<Button onClick={onClose} type="button" variant="secondary">
							Cancel
						</Button>
						<Button
							className={cn(!canSubmit && "opacity-50")}
							disabled={!canSubmit || isSaving}
							onClick={handleSubmit}
							type="button"
						>
							{isSaving ? "Saving..." : "Save"}
						</Button>
					</div>
				</footer>
			</DialogContent>
		</Dialog>
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
