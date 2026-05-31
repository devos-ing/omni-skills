import {
	assertObjectRecord,
	encodePathSegment,
	parseListResponse,
	readNullableNumber,
	readNullableString,
	readString,
} from "./response-utils";
import { parseProjectBoardTaskRecord } from "./task-client";
import type {
	HealthRequestOptions,
	ProjectBoardRecord,
	ProjectBoardStatusColumn,
	ProjectCreateRequest,
	ProjectUpdateRequest,
	WorkspaceProjectRecord,
	WorkspaceProjectsResponse,
} from "./types/client.types";

const WORKSPACE_PROJECTS_BASE_PATH = "/api/workspaces";

function parseWorkspaceProjectRecord(payload: unknown): WorkspaceProjectRecord {
	const endpoint = "/api/workspaces/:workspaceId/projects";
	const row = assertObjectRecord(payload, endpoint);
	return {
		id: readString(row, "id", endpoint),
		boardId: readString(row, "boardId", endpoint),
		workspaceId: readWorkspaceId(row, endpoint),
		externalProjectId: readNullableString(row, "externalProjectId", endpoint),
		name: readString(row, "name", endpoint),
		emoji: readOptionalProjectEmoji(row, endpoint),
		description: readNullableString(row, "description", endpoint),
		repoOwner: readNullableString(row, "repoOwner", endpoint),
		repoName: readNullableString(row, "repoName", endpoint),
		baseBranch: readNullableString(row, "baseBranch", endpoint),
		localFolder: readNullableString(row, "localFolder", endpoint),
		lead: readNullableString(row, "lead", endpoint),
		category: readNullableString(row, "category", endpoint),
		priority: readNullableNumber(row, "priority", endpoint),
		createdAt: readString(row, "createdAt", endpoint),
		updatedAt: readString(row, "updatedAt", endpoint),
	};
}

function readOptionalProjectEmoji(
	row: Record<string, unknown>,
	endpoint: string,
): string | null {
	return "emoji" in row ? readNullableString(row, "emoji", endpoint) : null;
}

function readWorkspaceId(
	row: Record<string, unknown>,
	endpoint: string,
): string {
	return typeof row.workspaceId === "string"
		? readString(row, "workspaceId", endpoint)
		: readString(row, "ownerId", endpoint);
}

function parseWorkspaceProjectsResponse(
	payload: unknown,
): WorkspaceProjectsResponse {
	const endpoint = "/api/workspaces/:workspaceId/projects";
	const row = assertObjectRecord(payload, endpoint);
	return {
		workspaceId: readString(row, "workspaceId", endpoint),
		projects: parseListResponse(
			row.projects,
			`${endpoint}:projects`,
			parseWorkspaceProjectRecord,
		),
	};
}

function parseProjectBoardStatusColumn(
	payload: unknown,
): ProjectBoardStatusColumn {
	const endpoint = "/api/workspaces/:workspaceId/projects/:projectId/board";
	const row = assertObjectRecord(payload, endpoint);
	return {
		status: readString(row, "status", endpoint),
		tasks: parseListResponse(
			row.tasks,
			`${endpoint}:tasks`,
			parseProjectBoardTaskRecord,
		),
	};
}

function parseProjectBoardRecord(payload: unknown): ProjectBoardRecord {
	const endpoint = "/api/workspaces/:workspaceId/projects/:projectId/board";
	const row = assertObjectRecord(payload, endpoint);
	return {
		project: parseWorkspaceProjectRecord(row.project),
		statusColumns: parseListResponse(
			row.statusColumns,
			`${endpoint}:statusColumns`,
			parseProjectBoardStatusColumn,
		),
	};
}

function workspaceProjectsPath(workspaceId: string): string {
	return `${WORKSPACE_PROJECTS_BASE_PATH}/${encodePathSegment(workspaceId)}/projects`;
}

function projectBoardPath(workspaceId: string, projectId: string): string {
	return `${workspaceProjectsPath(workspaceId)}/${encodePathSegment(projectId)}/board`;
}

function projectPath(projectId: string): string {
	return `/api/projects/${encodePathSegment(projectId)}`;
}

export interface BoardApiMethods {
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
}

export function createBoardApiMethods(
	requestWithBase: (
		path: string,
		method: "GET" | "POST" | "PATCH" | "DELETE",
		options?: HealthRequestOptions,
		body?: unknown,
	) => Promise<unknown>,
): BoardApiMethods {
	return {
		async listWorkspaceProjects(workspaceId, options) {
			const payload = await requestWithBase(
				workspaceProjectsPath(workspaceId),
				"GET",
				options,
			);
			return parseWorkspaceProjectsResponse(payload).projects;
		},
		async createProject(request, options) {
			const payload = await requestWithBase(
				"/api/projects",
				"POST",
				options,
				request,
			);
			return parseWorkspaceProjectRecord(payload);
		},
		async updateProject(projectId, request, options) {
			const payload = await requestWithBase(
				projectPath(projectId),
				"PATCH",
				options,
				request,
			);
			return parseWorkspaceProjectRecord(payload);
		},
		async getProjectBoard(workspaceId, projectId, options) {
			const payload = await requestWithBase(
				projectBoardPath(workspaceId, projectId),
				"GET",
				options,
			);
			return parseProjectBoardRecord(payload);
		},
	};
}
