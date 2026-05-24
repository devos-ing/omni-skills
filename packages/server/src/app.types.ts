import type { ServerDatabase } from "devos-db";
import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandRequest,
	CliCommandStreamEmit,
	NotificationServerRequest,
} from "devos/features/server";
import type { BoardRepository } from "./board";
import type { NotificationService } from "./notifications/notifications-service";
import type { RealtimeEventPublisher } from "./realtime";
import type { ReadRepositories } from "./repositories.types";
import type { RegisteredWorkflowComputer } from "./workflow-data";

export interface CliExecutor {
	execute(request: CliCommandRequest): Promise<CliCommandExecutionResult>;
	executeStream?(
		request: CliCommandRequest,
		emit: CliCommandStreamEmit,
	): Promise<CliCommandExecutionResult>;
	getHistory(): CliCommandExecutionHistoryEntry[];
	listComputers?(): RegisteredWorkflowComputer[];
}

export interface AppDeps {
	cliExecutor: CliExecutor;
	db?: ServerDatabase["db"];
	boardRepository?: BoardRepository;
	notificationSender?: {
		sendNotification(request: NotificationServerRequest): Promise<void>;
	};
	notificationService?: NotificationService;
	realtimeEvents?: RealtimeEventPublisher;
	repositories?: ReadRepositories;
}

export type RouteHandler = (request: Request) => Response | Promise<Response>;

export interface WorkspaceProjectRecord {
	id: string;
	boardId: string;
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
	ownerId: string;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectBoardTaskRecord {
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
	linearIssueId: string | null;
	linearIdentifier: string | null;
	linearUrl: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface ProjectBoardRecord {
	id: string;
	name: string;
	description: string | null;
	ownerId: string;
	createdAt: string;
	updatedAt: string;
	projects: WorkspaceProjectRecord[];
	tasks: ProjectBoardTaskRecord[];
}

export interface BoardReadModels {
	listWorkspaceProjects(workspaceId: string): Promise<WorkspaceProjectRecord[]>;
	getProjectBoard(
		workspaceId: string,
		projectId: string,
	): Promise<ProjectBoardRecord>;
}
