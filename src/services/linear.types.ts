import type { PlannedSplitTask, ResolvedProjectConfig } from "../core/types";

export type WorkflowLabelStage =
	keyof ResolvedProjectConfig["linear"]["labelMap"];
export type LinearStatusStage =
	keyof ResolvedProjectConfig["linear"]["statusMap"];

export interface LinearLabelRecord {
	id: string;
	name: string;
	teamId?: string;
}

export interface ParentIssueRef {
	id: string;
	key: string;
	title: string;
	url: string;
	projectId?: string;
	teamId?: string;
	creatorId?: string;
	assigneeId?: string;
}

export interface CreatedLinearIssueRef {
	id: string;
	identifier: string;
	title: string;
	url: string;
}

export interface TodoIssueFromPlanInput {
	title: string;
	description: string;
	stateId: string;
	teamId: string;
	parentId: string;
	projectId?: string;
	assigneeId?: string;
	priority?: number;
}

export interface WorkflowLabelUpdate {
	addedLabelIds: string[];
	removedLabelIds: string[];
}

export interface SplitTaskIssueDescriptionInput {
	task: PlannedSplitTask;
	parentIssue: ParentIssueRef;
}

export interface BuildTodoIssueInput {
	task: PlannedSplitTask;
	parentIssue: ParentIssueRef;
	assignedStateId: string;
	teamId: string;
	projectId?: string;
}
