"use client";

import {
	type ChangeEvent,
	type ReactElement,
	useEffect,
	useRef,
	useState,
} from "react";

import { Input } from "@/components/ui/input";
import {
	NativeSelect,
	NativeSelectOption,
} from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import { Typography } from "@/components/ui/typography";
import type { ProjectBoardTaskRecord, TaskMutationRequest } from "@/lib/api";
import { useUpdateBoardTaskMutation } from "@/lib/api/queries";

import {
	DetailField,
	createDetailDraft,
	createSaveRequest,
	formatDateTime,
} from "./issue-detail-editor-utils";
import { getStatusLabel } from "./issues-board-utils";
import { STATUS_ORDER } from "./issues-board.constants";
import { PriorityDropdown } from "./priority-dropdown";
import type {
	IssueDetailDraft,
	IssueDetailSaveState,
	IssuePriority,
} from "./types/issues-board.types";

const AUTOSAVE_DELAY_MS = 3000;

export function IssueDetailEditor({
	task,
}: {
	task: ProjectBoardTaskRecord;
}): ReactElement {
	const [draft, setDraft] = useState<IssueDetailDraft>(() =>
		createDetailDraft(task),
	);
	const [saveState, setSaveState] = useState<IssueDetailSaveState>("idle");
	const [errorMessage, setErrorMessage] = useState<string | null>(null);
	const saveTimerRef = useRef<number | null>(null);
	const saveVersionRef = useRef(0);
	const updateTask = useUpdateBoardTaskMutation();

	useEffect(() => {
		return () => {
			if (saveTimerRef.current) {
				window.clearTimeout(saveTimerRef.current);
			}
		};
	}, []);

	function updateDraft(nextDraft: IssueDetailDraft): void {
		setDraft(nextDraft);
		scheduleSave(nextDraft);
	}

	function scheduleSave(nextDraft: IssueDetailDraft): void {
		if (saveTimerRef.current) {
			window.clearTimeout(saveTimerRef.current);
		}
		const request = createSaveRequest(nextDraft, task.projectId);
		if (!request.ok) {
			setSaveState("error");
			setErrorMessage(request.error);
			return;
		}
		setSaveState("saving");
		setErrorMessage(null);
		const saveVersion = saveVersionRef.current + 1;
		saveVersionRef.current = saveVersion;
		saveTimerRef.current = window.setTimeout(() => {
			void saveDraft(request.value, saveVersion);
		}, AUTOSAVE_DELAY_MS);
	}

	async function saveDraft(
		request: TaskMutationRequest,
		saveVersion: number,
	): Promise<void> {
		try {
			await updateTask.mutateAsync({ taskId: task.id, task: request });
			if (saveVersionRef.current === saveVersion) {
				setSaveState("saved");
			}
		} catch (error) {
			if (saveVersionRef.current === saveVersion) {
				setSaveState("error");
				setErrorMessage(error instanceof Error ? error.message : "Save failed");
			}
		}
	}

	function updateField(
		field: keyof IssueDetailDraft,
		event: ChangeEvent<
			HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
		>,
	): void {
		updateDraft({ ...draft, [field]: event.target.value });
	}

	function updatePriority(priority: IssuePriority): void {
		updateDraft({ ...draft, priority: String(priority) });
	}

	return (
		<article className="grid gap-5">
			<section className="rounded-lg border border-border bg-card p-5">
				<div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-sm text-muted-foreground">
					<div className="flex min-w-0 flex-wrap items-center gap-2">
						<Typography variant="description">{task.taskKey}</Typography>
						<Typography variant="description">/</Typography>
						<Typography className="break-all" variant="description">
							{task.id}
						</Typography>
					</div>
					<SaveStatus errorMessage={errorMessage} saveState={saveState} />
				</div>
				<EditableField label="Title">
					<Input
						aria-label="Title"
						className="text-lg font-medium"
						onChange={(event) => updateField("title", event)}
						value={draft.title}
					/>
				</EditableField>
				<EditableField label="Description">
					<Textarea
						aria-label="Description"
						className="mt-3 min-h-36 resize-y leading-6"
						onChange={(event) => updateField("content", event)}
						value={draft.content}
					/>
				</EditableField>
			</section>
			<section className="grid gap-3 rounded-lg border border-border bg-card p-5 sm:grid-cols-2">
				<EditableField label="Status">
					<NativeSelect
						aria-label="Status"
						onChange={(event) => updateField("status", event)}
						value={draft.status}
					>
						{STATUS_ORDER.map((status) => (
							<NativeSelectOption key={status} value={status}>
								{getStatusLabel(status)}
							</NativeSelectOption>
						))}
					</NativeSelect>
				</EditableField>
				<EditableField label="Priority">
					<PriorityDropdown value={draft.priority} onChange={updatePriority} />
				</EditableField>
				<EditableField label="Creator">
					<Input
						aria-label="Creator"
						onChange={(event) => updateField("creatorId", event)}
						value={draft.creatorId}
					/>
				</EditableField>
				<EditableField label="Due date">
					<Input
						aria-label="Due date"
						onChange={(event) => updateField("dueDate", event)}
						type="date"
						value={draft.dueDate}
					/>
				</EditableField>
				<DetailField label="Project">
					{task.projectId ?? "No project"}
				</DetailField>
				<EditableField label="Linked PR">
					<Input
						aria-label="Linked PR"
						onChange={(event) => updateField("linkedPr", event)}
						placeholder="https://github.com/org/repo/pull/123"
						value={draft.linkedPr}
					/>
				</EditableField>
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

function SaveStatus({
	errorMessage,
	saveState,
}: {
	errorMessage: string | null;
	saveState: IssueDetailSaveState;
}): ReactElement {
	const label =
		saveState === "saving"
			? "Saving..."
			: saveState === "saved"
				? "Saved"
				: saveState === "error"
					? (errorMessage ?? "Save failed")
					: "Autosave ready";
	return <Typography variant="muted">{label}</Typography>;
}

function EditableField({
	children,
	label,
}: {
	children: ReactElement;
	label: string;
}): ReactElement {
	return (
		<div className="grid gap-1.5">
			<Typography className="text-zinc-400" variant="label">
				{label}
			</Typography>
			{children}
		</div>
	);
}
