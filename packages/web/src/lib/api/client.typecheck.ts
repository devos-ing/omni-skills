import { createApiClient } from "./client";
import type {
	AgentRecord,
	HealthResponse,
	ProjectBoardRecord,
	ProjectBoardTaskRecord,
	TaskCreateRequest,
	TaskCreateResponse,
	TaskMutationRequest,
	WorkspaceProjectRecord,
} from "./client.types";
import { createWebApiClient } from "./web-client";

const client = createApiClient();
const webClient = createWebApiClient();

const healthResponsePromise: Promise<HealthResponse> = client.getHealth();
const webHealthResponsePromise: Promise<HealthResponse> = webClient.getHealth();
const agentRecordsPromise: Promise<AgentRecord[]> = webClient.listAgents();
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
const projectBoardPromise: Promise<ProjectBoardRecord> =
	webClient.getProjectBoard("owner-1", "project-1");
const inboxMessagesPromise = webClient.listInboxMessages({
	workspaceId: "workspace-1",
	userId: "user-1",
	runId: "run-1",
});
const boardTasksPromise: Promise<ProjectBoardTaskRecord[]> =
	webClient.listBoardTasks();
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

void healthResponsePromise;
void webHealthResponsePromise;
void agentRecordsPromise;
void taskCreateResponsePromise;
void unassignedTaskCreateResponsePromise;
void workspaceProjectsPromise;
void projectBoardPromise;
void inboxMessagesPromise;
void boardTasksPromise;
void createdBoardTaskPromise;
void updatedBoardTaskPromise;
void deletedBoardTaskPromise;
