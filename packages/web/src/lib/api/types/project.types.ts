export interface WorkspaceProjectRecord {
	id: string;
	boardId: string;
	workspaceId: string;
	externalProjectId: string | null;
	name: string;
	emoji: string | null;
	description: string | null;
	repoOwner: string | null;
	repoName: string | null;
	baseBranch: string | null;
	localFolder: string | null;
	lead: string | null;
	category: string | null;
	priority: number | null;
	isPinned: boolean;
	preHookScript: string | null;
	afterHookScript: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectCreateRequest {
	boardId: string;
	ownerId: string;
	name: string;
	emoji?: string | null;
	externalProjectId?: string | null;
	description?: string | null;
	repoOwner?: string | null;
	repoName?: string | null;
	baseBranch?: string | null;
	localFolder?: string | null;
	lead?: string | null;
	category?: string | null;
	priority?: number | null;
	isPinned?: boolean;
	preHookScript?: string | null;
	afterHookScript?: string | null;
}

export interface ProjectUpdateRequest {
	boardId?: string;
	ownerId?: string;
	name?: string;
	emoji?: string | null;
	externalProjectId?: string | null;
	description?: string | null;
	repoOwner?: string | null;
	repoName?: string | null;
	baseBranch?: string | null;
	localFolder?: string | null;
	lead?: string | null;
	category?: string | null;
	priority?: number | null;
	isPinned?: boolean;
	preHookScript?: string | null;
	afterHookScript?: string | null;
}

export interface WorkspaceProjectsResponse {
	workspaceId: string;
	projects: WorkspaceProjectRecord[];
}
