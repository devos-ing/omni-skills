export type HealthStatus = "ok";

export interface HealthResponse {
	status: HealthStatus;
}

export interface HealthRequestOptions {
	signal?: AbortSignal;
}

export interface TokenUsageRecord {
	id: string;
	runId: string;
	stage: string;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
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

export interface AgentRecord {
	id: string;
	name: string;
	description: string;
	logo: string;
	runtime: string;
	backend: string;
	model: string;
	concurrency: number;
	owner: string;
	createdAt: string;
	updatedAt: string;
	skills: string[];
	recentWork: string[];
	activity: string[];
	instructions: string;
}

export interface AgentUpdateRequest {
	name?: string;
	description?: string;
	logo?: string;
	runtime?: string;
	backend?: string;
	model?: string;
	concurrency?: number;
	owner?: string;
	createdAt?: string;
	updatedAt?: string;
	skills?: string[];
	recentWork?: string[];
	activity?: string[];
	instructions?: string;
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

export interface WorkspaceProjectRecord {
	id: string;
	boardId: string;
	workspaceId: string;
	externalProjectId: string | null;
	name: string;
	description: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectBoardTaskRecord {
	id: string;
	projectId: string;
	title: string;
	content: string;
	priority: number;
	status: string;
	dueDate: string | null;
	creatorId: string;
	linkedPr: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectBoardRecord {
	project: WorkspaceProjectRecord;
	statusColumns: ProjectBoardStatusColumn[];
}

export interface ProjectBoardStatusColumn {
	status: string;
	tasks: ProjectBoardTaskRecord[];
}

export interface WorkspaceProjectsResponse {
	workspaceId: string;
	projects: WorkspaceProjectRecord[];
}

export interface TaskMutationRequest {
	projectId: string;
	title: string;
	content: string;
	priority: number;
	status: string;
	creatorId: string;
	dueDate?: string | null;
	linkedPr?: string | null;
}

export interface TaskCreateAnswer {
	question: string;
	answer: string;
}

export interface TaskCreateRequest {
	request: string;
	projectId?: string;
	answers?: TaskCreateAnswer[];
}

export interface CreatedTaskRef {
	identifier: string;
	url: string;
}

export type TaskCreateResponse =
	| {
			status: "created";
			issue: CreatedTaskRef;
			rawOutput: string;
	  }
	| {
			status: "needs_info";
			questions: string[];
			rawOutput: string;
	  }
	| {
			status: "error";
			error: string;
			rawOutput: string;
	  };

export interface CliDispatchStreamRequest {
	action: string;
	[key: string]: unknown;
}

export type CliDispatchStreamEvent =
	| {
			type: "start";
			request: CliDispatchStreamRequest;
			invocation: { command: string; args: string[] };
	  }
	| { type: "stdout"; text: string }
	| { type: "stderr"; text: string }
	| { type: "error"; error: string }
	| {
			type: "complete";
			result: {
				status: "succeeded" | "failed" | "rejected";
				request: CliDispatchStreamRequest;
				invocation?: { command: string; args: string[] };
				commandResult?: { code: number; stdout: string; stderr: string };
				error?: string;
			};
	  };

export type CliDispatchStreamHandler = (event: CliDispatchStreamEvent) => void;

export interface ApiClientOptions {
	baseUrl?: string;
	fetchFn?: typeof fetch;
	headers?: HeadersInit;
}

export interface ApiClient {
	getHealth(options?: HealthRequestOptions): Promise<HealthResponse>;
	listTokenUsage(options?: HealthRequestOptions): Promise<TokenUsageRecord[]>;
	listJobs(options?: HealthRequestOptions): Promise<JobRecord[]>;
	listAgents(options?: HealthRequestOptions): Promise<AgentRecord[]>;
	updateAgent(
		agentId: string,
		request: AgentUpdateRequest,
		options?: HealthRequestOptions,
	): Promise<AgentRecord>;
	listSkills(options?: HealthRequestOptions): Promise<SkillRecord[]>;
	listCommandHistory(
		options?: HealthRequestOptions,
	): Promise<CommandHistoryRecord[]>;
	listWorkspaceProjects(
		workspaceId: string,
		options?: HealthRequestOptions,
	): Promise<WorkspaceProjectRecord[]>;
	getProjectBoard(
		workspaceId: string,
		projectId: string,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardRecord>;
	createTask(
		request: TaskCreateRequest,
		options?: HealthRequestOptions,
	): Promise<TaskCreateResponse>;
	streamCliDispatch(
		request: CliDispatchStreamRequest,
		onEvent: CliDispatchStreamHandler,
		options?: HealthRequestOptions,
	): Promise<void>;
	createBoardTask(
		request: TaskMutationRequest,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
	updateBoardTask(
		taskId: string,
		request: Partial<TaskMutationRequest>,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
	deleteBoardTask(
		taskId: string,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
}
