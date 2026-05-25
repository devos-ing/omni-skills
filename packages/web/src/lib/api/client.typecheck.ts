import { createApiClient } from "./client";
import type {
	AgentRecord,
	ChatSendResponse,
	ChatSessionRecord,
	HealthResponse,
	PollingStatusResponse,
	ProjectBoardRecord,
	ProjectBoardTaskRecord,
	ProjectCreateRequest,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
	WorkspaceProjectRecord,
} from "./types/client.types";
import { createWebApiClient } from "./web-client";
import { buildIssueRunCommand } from "./workflow-run-command";

const client = createApiClient();
const webClient = createWebApiClient();

const healthResponsePromise: Promise<HealthResponse> = client.getHealth();
const webHealthResponsePromise: Promise<HealthResponse> = webClient.getHealth();
const agentRecordsPromise: Promise<AgentRecord[]> = webClient.listAgents();
const chatSessionPromise: Promise<ChatSessionRecord> =
	webClient.createChatSession({
		workspaceId: "owner-1",
	});
const chatSendPromise: Promise<ChatSendResponse> = webClient.sendChatMessage(
	"session-1",
	{ content: "Create the issue plan" },
);
const taskCreateRequest: TaskCreateRequest = {
	request: "Create a task from web UI",
	projectId: "project-1",
};
const unassignedTaskCreateRequest: TaskCreateRequest = {
	request: "Create an unassigned task from web UI",
};
const taskCreateResponsePromise: Promise<TaskCreateResponse> =
	webClient.createTask(taskCreateRequest);
const unassignedTaskCreateResponsePromise: Promise<TaskCreateResponse> =
	webClient.createTask(unassignedTaskCreateRequest);
const workspaceProjectsPromise: Promise<WorkspaceProjectRecord[]> =
	webClient.listWorkspaceProjects("owner-1");
const projectCreateRequest: ProjectCreateRequest = {
	boardId: "board-1",
	ownerId: "owner-1",
	name: "Project",
};
const createProjectPromise: Promise<WorkspaceProjectRecord> =
	webClient.createProject(projectCreateRequest);
const projectBoardPromise: Promise<ProjectBoardRecord> =
	webClient.getProjectBoard("owner-1", "project-1");
const inboxMessagesPromise = webClient.listInboxMessages({
	workspaceId: "workspace-1",
	userId: "user-1",
	runId: "run-1",
});
const boardTasksPromise: Promise<ProjectBoardTaskRecord[]> =
	webClient.listBoardTasks();
const pollingStatusPromise: Promise<PollingStatusResponse> =
	webClient.listPollingStatus();
const taskMutationRequest: TaskMutationRequest = {
	projectId: "project-1",
	title: "Add issue board",
	content: "Render persisted issue board",
	priority: 1,
	status: "planning",
	creatorId: "member-1",
	assigneeId: "member-2",
};
const createdBoardTaskPromise: Promise<ProjectBoardTaskRecord> =
	webClient.createBoardTask(taskMutationRequest);
const updatedBoardTaskPromise: Promise<ProjectBoardTaskRecord> =
	webClient.updateBoardTask("task-1", { status: "reviewing" });
const deletedBoardTaskPromise: Promise<ProjectBoardTaskRecord> =
	webClient.deleteBoardTask("task-1");
const runIssueStreamPromise: Promise<void> = webClient.streamCliCommand(
	buildIssueRunCommand({ projectId: "project-1", issueKey: "TASK-1" }),
	(event) => {
		if (event.type === "progress") {
			const kind: string | undefined = event.event.kind;
			void kind;
		}
	},
);

void healthResponsePromise;
void webHealthResponsePromise;
void agentRecordsPromise;
void chatSessionPromise;
void chatSendPromise;
void taskCreateResponsePromise;
void unassignedTaskCreateResponsePromise;
void workspaceProjectsPromise;
void createProjectPromise;
void projectBoardPromise;
void inboxMessagesPromise;
void boardTasksPromise;
void pollingStatusPromise;
void createdBoardTaskPromise;
void updatedBoardTaskPromise;
void deletedBoardTaskPromise;
void runIssueStreamPromise;
