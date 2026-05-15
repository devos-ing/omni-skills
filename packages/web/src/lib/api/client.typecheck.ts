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
const taskCreateResponsePromise: Promise<TaskCreateResponse> =
	webClient.createTask(taskCreateRequest);
const workspaceProjectsPromise: Promise<WorkspaceProjectRecord[]> =
	webClient.listWorkspaceProjects("owner-1");
const projectBoardPromise: Promise<ProjectBoardRecord> =
	webClient.getProjectBoard("owner-1", "project-1");
const taskMutationRequest: TaskMutationRequest = {
	projectId: "project-1",
	title: "Add issue board",
	content: "Render persisted issue board",
	priority: 1,
	status: "planning",
	creatorId: "member-1",
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
void workspaceProjectsPromise;
void projectBoardPromise;
void createdBoardTaskPromise;
void updatedBoardTaskPromise;
void deletedBoardTaskPromise;
