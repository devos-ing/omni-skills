import type { ProjectBoardTaskRecord } from "../../../lib/api";
import type { BoardTaskMutationInput } from "../../../lib/api/types/queries.types";

export type IssueTab = "all" | "members" | "agents";
export type IssuePriority = 0 | 1 | 2 | 3 | 4;

export interface PriorityOption {
	value: IssuePriority;
	label: string;
}

export interface StatusPresentation {
	label: string;
	tone: string;
}

export interface IssueDragState {
	taskId: string;
	status: string;
}

export interface IssueContextMenuState {
	task: ProjectBoardTaskRecord;
	x: number;
	y: number;
}

export type IssueQuickUpdate = Partial<BoardTaskMutationInput>;

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
