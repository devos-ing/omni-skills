import type {
	ChatMessageCreateRequest,
	ChatMessageRecord,
	ChatSendRequest,
	ChatSendResponse,
	ChatSessionCreateRequest,
	ChatSessionRecord,
	ChatSessionUpdateRequest,
} from "./chat.types";
import type {
	CliCommandStreamHandler,
	CliCommandStreamRequest,
} from "./command-stream-client.types";
import type { PollingStatusResponse } from "./polling-status.types";
import type { TaskActivityResponse } from "./task-activity.types";
import type {
	ProjectBoardRecord,
	ProjectBoardTaskRecord,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
} from "./task.types";

export type {
	ProjectBoardRecord,
	ProjectBoardStatusColumn,
	ProjectBoardTaskRecord,
	TaskCreateAnswer,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
} from "./task.types";
export type { PollingStatusResponse } from "./polling-status.types";
export type {
	ChatMessageCreateRequest,
	ChatMessageKind,
	ChatMessageRecord,
	ChatMessageRole,
	ChatSendRequest,
	ChatSendResponse,
	ChatSessionCreateRequest,
	ChatSessionRecord,
	ChatSessionUpdateRequest,
} from "./chat.types";

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
	repoOwner: string | null;
	repoName: string | null;
	baseBranch: string | null;
	localFolder: string | null;
	lead: string | null;
	category: string | null;
	priority: number | null;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectCreateRequest {
	boardId: string;
	ownerId: string;
	name: string;
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

export interface InboxMessageScope {
	workspaceId: string;
	userId: string;
	runId: string;
}

export interface InboxMessageRecord extends InboxMessageScope {
	id: string;
	source: string;
	kind: string;
	body: string;
	taskId: string | null;
	agentId: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
}

export interface WorkspaceProjectsResponse {
	workspaceId: string;
	projects: WorkspaceProjectRecord[];
}

export interface ApiClientOptions {
	baseUrl?: string;
	wsUrl?: string;
	fetchFn?: typeof fetch;
	headers?: HeadersInit;
	WebSocketImpl?: typeof WebSocket;
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
	listChatSessions(
		workspaceId: string,
		options?: HealthRequestOptions,
	): Promise<ChatSessionRecord[]>;
	createChatSession(
		request: ChatSessionCreateRequest,
		options?: HealthRequestOptions,
	): Promise<ChatSessionRecord>;
	updateChatSession(
		sessionId: string,
		request: ChatSessionUpdateRequest,
		options?: HealthRequestOptions,
	): Promise<ChatSessionRecord>;
	listChatMessages(
		sessionId: string,
		options?: HealthRequestOptions,
	): Promise<ChatMessageRecord[]>;
	appendChatMessage(
		sessionId: string,
		request: ChatMessageCreateRequest,
		options?: HealthRequestOptions,
	): Promise<ChatMessageRecord>;
	sendChatMessage(
		sessionId: string,
		request: ChatSendRequest,
		options?: HealthRequestOptions,
	): Promise<ChatSendResponse>;
	listPollingStatus(
		options?: HealthRequestOptions,
	): Promise<PollingStatusResponse>;
	listBoardTasks(
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord[]>;
	getBoardTask(
		taskId: string,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardTaskRecord>;
	listTaskActivity(
		taskId: string,
		options?: HealthRequestOptions,
	): Promise<TaskActivityResponse>;
	listWorkspaceProjects(
		workspaceId: string,
		options?: HealthRequestOptions,
	): Promise<WorkspaceProjectRecord[]>;
	createProject(
		request: ProjectCreateRequest,
		options?: HealthRequestOptions,
	): Promise<WorkspaceProjectRecord>;
	getProjectBoard(
		workspaceId: string,
		projectId: string,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardRecord>;
	listInboxMessages(
		scope: InboxMessageScope,
		options?: HealthRequestOptions,
	): Promise<InboxMessageRecord[]>;
	createTask(
		request: TaskCreateRequest,
		options?: HealthRequestOptions,
	): Promise<TaskCreateResponse>;
	streamCliCommand(
		request: CliCommandStreamRequest,
		onEvent: CliCommandStreamHandler,
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
