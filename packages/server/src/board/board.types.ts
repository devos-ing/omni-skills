export const REQUIRED_BOARD_STATUSES = [
	"planning",
	"implementing",
	"pr_created",
	"reviewing",
	"testing",
	"done",
] as const;

export type BoardStatus = (typeof REQUIRED_BOARD_STATUSES)[number];

export interface WorkspaceProjectSummary {
	id: string;
	boardId: string;
	workspaceId: string;
	externalProjectId: string | null;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface BoardTaskSummary {
	id: string;
	projectId: string;
	title: string;
	content: string;
	priority: number;
	status: string;
	dueDate: string | null;
	creatorId: string;
	linkedPr: string | null;
	linearIssueId: string | null;
	linearIdentifier: string | null;
	linearUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface BoardStatusColumn {
	status: BoardStatus;
	tasks: BoardTaskSummary[];
}

export interface WorkspaceProjectBoard {
	project: WorkspaceProjectSummary;
	statusColumns: BoardStatusColumn[];
}

export interface BoardRepository {
	listWorkspaceProjects(
		workspaceId: string,
	): Promise<WorkspaceProjectSummary[]>;
	getWorkspaceProjectBoard(
		workspaceId: string,
		projectId: string,
	): Promise<WorkspaceProjectBoard | null>;
}
