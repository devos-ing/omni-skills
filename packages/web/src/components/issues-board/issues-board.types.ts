import type { ProjectBoardTaskRecord } from "@/lib/api";

export type IssueTab = "all" | "members" | "agents";
export type IssueDialogMode = "create" | "edit";

export interface IssueDraft {
	title: string;
	content: string;
	priority: string;
	status: string;
	dueDate: string;
	linkedPr: string;
	creatorId: string;
}

export type IssueDialogState =
	| { mode: "create"; status: string }
	| { mode: "edit"; task: ProjectBoardTaskRecord }
	| null;

export interface StatusPresentation {
	label: string;
	tone: string;
}

export interface IssueDragState {
	taskId: string;
	status: string;
}

export interface IssueDetailDraft {
	title: string;
	content: string;
	priority: string;
	status: string;
	creatorId: string;
	dueDate: string;
	linkedPr: string;
}

export type IssueDetailSaveState = "idle" | "saving" | "saved" | "error";
