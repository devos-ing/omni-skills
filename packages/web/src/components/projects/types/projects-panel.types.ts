import type { WorkspaceProjectRecord } from "@/lib/api";

export interface ProjectFormState {
	name: string;
	externalProjectId: string;
	description: string;
	repositoryUrl: string;
	localFolder: string;
	lead: string;
	category: string;
	priority: string;
}

export interface ProjectCreateDefaults {
	boardId: string;
	ownerId: string;
}

export interface ProjectFieldConfig {
	name: keyof ProjectFormState;
	label: string;
	placeholder?: string;
	type?: "number" | "text";
}

export interface ProjectFieldGroup {
	title: string;
	fields: ProjectFieldConfig[];
}

export type ProjectTableDensity = "compact" | "comfortable";

export interface ProjectDisplayRow {
	project: WorkspaceProjectRecord;
	priorityLabel: string;
	categoryLabel: string;
	repositoryLabel: string;
	leadLabel: string;
	createdLabel: string;
	summaryLabel: string;
}
