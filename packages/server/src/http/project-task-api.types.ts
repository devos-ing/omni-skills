export interface CreateProjectPayload {
	boardId: string;
	name: string;
	ownerId: string;
	externalProjectId?: string | null;
	description?: string | null;
	repoOwner?: string | null;
	repoName?: string | null;
	baseBranch?: string | null;
	localFolder?: string | null;
	lead?: string | null;
	category?: string | null;
	priority?: number | null;
}

export interface UpdateProjectPayload {
	boardId?: string;
	name?: string;
	ownerId?: string;
	externalProjectId?: string | null;
	description?: string | null;
	repoOwner?: string | null;
	repoName?: string | null;
	baseBranch?: string | null;
	localFolder?: string | null;
	lead?: string | null;
	category?: string | null;
	priority?: number | null;
}

export interface CreateTaskPayload {
	taskKey?: string;
	projectId?: string | null;
	title: string;
	content: string;
	priority: number;
	status: string;
	creatorId: string;
	assigneeId?: string | null;
	dueDate?: string | null;
	linkedPr?: string | null;
	linearIssueId?: string | null;
	linearIdentifier?: string | null;
	linearUrl?: string | null;
}

export interface UpdateTaskPayload {
	taskKey?: string;
	projectId?: string | null;
	title?: string;
	content?: string;
	priority?: number;
	status?: string;
	creatorId?: string;
	assigneeId?: string | null;
	dueDate?: string | null;
	linkedPr?: string | null;
	linearIssueId?: string | null;
	linearIdentifier?: string | null;
	linearUrl?: string | null;
}
