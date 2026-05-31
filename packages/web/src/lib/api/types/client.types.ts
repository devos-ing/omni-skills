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
import type {
	GitHubRepositoriesResponse,
	GitHubRepositoryRecord,
} from "./github.types";
import type { HealthRequestOptions, HealthResponse } from "./health.types";
import type { InboxMessageRecord, InboxMessageScope } from "./inbox.types";
import type { PollingStatusResponse } from "./polling-status.types";
import type {
	ProjectCreateRequest,
	ProjectUpdateRequest,
	WorkspaceProjectRecord,
	WorkspaceProjectsResponse,
} from "./project.types";
import type {
	AgentRecord,
	AgentStatus,
	AgentUpdateRequest,
	CommandHistoryRecord,
	JobRecord,
	SkillRecord,
	TokenUsageRecord,
} from "./server-state.types";
import type {
	SettingsModelsResponse,
	SettingsModelsUpdateRequest,
} from "./settings.types";
import type { TaskActivityResponse } from "./task-activity.types";
import type {
	ProjectBoardRecord,
	ProjectBoardTaskRecord,
	TaskClarificationOption,
	TaskClarificationQuestion,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
} from "./task.types";
import type { WorkflowComputerApiMethods } from "./workflow-computer.types";
import type { WorkspaceEnvironmentResponse } from "./workspace-environment.types";
import type { CurrentWorkspaceRecord } from "./workspace.types";

export type {
	ProjectBoardRecord,
	ProjectBoardStatusColumn,
	ProjectBoardTaskRecord,
	TaskClarificationOption,
	TaskClarificationQuestion,
	TaskCreateAnswer,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
} from "./task.types";
export type { PollingStatusResponse } from "./polling-status.types";
export type {
	SettingsModelOption,
	SettingsModelStage,
	SettingsModelStageId,
	SettingsModelStageUpdate,
	SettingsModelsResponse,
	SettingsModelsUpdateRequest,
	SettingsReasoningEffort,
} from "./settings.types";
export type {
	AgentRecord,
	AgentStatus,
	AgentUpdateRequest,
	CommandHistoryRecord,
	JobRecord,
	SkillRecord,
	TokenUsageRecord,
} from "./server-state.types";
export type {
	WorkspaceEnvironmentGitStatus,
	WorkspaceEnvironmentMcpSource,
	WorkspaceEnvironmentResponse,
} from "./workspace-environment.types";
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
export type { HealthRequestOptions, HealthResponse } from "./health.types";
export type { CurrentWorkspaceRecord } from "./workspace.types";
export type {
	ProjectCreateRequest,
	ProjectUpdateRequest,
	WorkspaceProjectRecord,
	WorkspaceProjectsResponse,
} from "./project.types";
export type {
	GitHubRepositoriesResponse,
	GitHubRepositoryRecord,
} from "./github.types";
export type { InboxMessageRecord, InboxMessageScope } from "./inbox.types";

export interface ApiClientOptions {
	baseUrl?: string;
	wsUrl?: string;
	fetchFn?: typeof fetch;
	headers?: HeadersInit;
	WebSocketImpl?: typeof WebSocket;
}

export interface ApiClient extends WorkflowComputerApiMethods {
	getHealth(options?: HealthRequestOptions): Promise<HealthResponse>;
	getCurrentWorkspace(
		options?: HealthRequestOptions,
	): Promise<CurrentWorkspaceRecord>;
	getWorkspaceEnvironment(
		projectId?: string,
		options?: HealthRequestOptions,
	): Promise<WorkspaceEnvironmentResponse>;
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
	getModelSettings(
		options?: HealthRequestOptions,
	): Promise<SettingsModelsResponse>;
	updateModelSettings(
		request: SettingsModelsUpdateRequest,
		options?: HealthRequestOptions,
	): Promise<SettingsModelsResponse>;
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
	updateProject(
		projectId: string,
		request: ProjectUpdateRequest,
		options?: HealthRequestOptions,
	): Promise<WorkspaceProjectRecord>;
	getProjectBoard(
		workspaceId: string,
		projectId: string,
		options?: HealthRequestOptions,
	): Promise<ProjectBoardRecord>;
	listGitHubRepositories(
		options?: HealthRequestOptions,
	): Promise<GitHubRepositoriesResponse>;
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
