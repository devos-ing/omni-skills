export interface TokenUsageRecord {
	id: string;
	runId: string;
	taskId: string | null;
	taskExecutionLogId: string | null;
	stage: string;
	agentBackend: string | null;
	model: string | null;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCostMicrousd: number | null;
	recordedAt: string;
}

export interface JobRecord {
	id: string;
	projectId: string;
	issueKey: string;
	stage: string;
	status: string;
	createdAt: string;
}

export type AgentReasoningEffort = "high" | "low" | "medium" | "xhigh";
export type AgentStatus = "offline" | "online";

export interface AgentRecord {
	id: string;
	name: string;
	description: string;
	logo: string;
	runtime: string;
	backend: string;
	model: string;
	reasoningEffort: AgentReasoningEffort | null;
	status: AgentStatus;
	concurrency: number;
	owner: string;
	createdAt: string;
	updatedAt: string;
	skills: string[];
	recentWork: string[];
	activity: string[];
	instructions: string;
}

export interface SkillRecord {
	id: string;
	name: string;
	description: string;
	source: string;
	updatedAt: string;
}

export interface CommandHistoryRecord {
	id: string;
	command: string;
	exitCode: number;
	executedAt: string;
}

export interface ProjectBoardRecord {
	id: string;
	name: string;
	description: string | null;
	ownerId: string;
	createdAt: string;
	updatedAt: string;
}

export interface BoardProjectRecord {
	id: string;
	boardId: string;
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
	ownerId: string;
	createdAt: string;
	updatedAt: string;
}

export interface BoardTaskRecord {
	id: string;
	taskKey: string;
	projectId: string | null;
	title: string;
	content: string;
	priority: number;
	status: string;
	dueDate: string | null;
	creatorId: string;
	assigneeId: string | null;
	linkedPr: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ReadRepositories {
	listTokenUsage(): Promise<TokenUsageRecord[]>;
	listJobs(): Promise<JobRecord[]>;
	listAgents(): Promise<AgentRecord[]>;
	listSkills(): Promise<SkillRecord[]>;
	listCommandHistory(): Promise<CommandHistoryRecord[]>;
	listProjectBoards(): Promise<ProjectBoardRecord[]>;
	listBoardProjects(): Promise<BoardProjectRecord[]>;
	listBoardTasks(): Promise<BoardTaskRecord[]>;
}
