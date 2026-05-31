export interface GitHubRepositoryRecord {
	id: string;
	owner: string;
	name: string;
	nameWithOwner: string;
	defaultBranch: string | null;
	isPrivate: boolean;
}

export interface GitHubRepositoriesResponse {
	isAvailable: boolean;
	unavailableReason: string | null;
	repositories: GitHubRepositoryRecord[];
}
