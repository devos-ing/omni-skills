import type { WorkspaceProjectRecord } from "@/lib/api";

export type ProjectRepositoryMode = "select" | "manual";

export interface ProjectFormState {
	name: string;
	emoji: string;
	description: string;
	repositoryMode: ProjectRepositoryMode;
	selectedRepository: string;
	manualRepository: string;
	lead: string;
	priority: string;
}

export interface ProjectCreateDefaults {
	boardId: string;
	ownerId: string;
}

export type ProjectTableDensity = "compact" | "comfortable";

export interface ProjectDisplayRow {
	project: WorkspaceProjectRecord;
	emojiLabel: string;
	priorityLabel: string;
	categoryLabel: string;
	repositoryLabel: string;
	leadLabel: string;
	createdLabel: string;
	summaryLabel: string;
}
