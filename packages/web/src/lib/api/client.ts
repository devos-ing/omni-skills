import { createBoardApiMethods } from "./board-client";
import type {
	ApiClient,
	ApiClientOptions,
	HealthRequestOptions,
} from "./client.types";
import { createCommandStreamApiMethods } from "./command-stream-client";
import { encodePathSegment } from "./response-utils";
import { requestJson } from "./response-utils";
import {
	parseAgentRecord,
	parseHealthResponse,
	parseServerList,
} from "./server-state-client";
import { createTaskApiMethods } from "./task-client";

type RequestMethod = "GET" | "POST" | "PATCH" | "DELETE";

export function createApiClient(options: ApiClientOptions = {}): ApiClient {
	const baseUrl = options.baseUrl ?? "";
	const wsUrl = options.wsUrl ?? deriveWsUrl(baseUrl);
	const fetchFn = options.fetchFn ?? fetch;
	const headers = options.headers;
	const requestWithBase = (
		path: string,
		method: RequestMethod,
		requestOptions?: HealthRequestOptions,
		body?: unknown,
	) =>
		requestJson(baseUrl, path, method, fetchFn, headers, requestOptions, body);
	const boardApiMethods = createBoardApiMethods(requestWithBase);
	const commandStreamApiMethods = createCommandStreamApiMethods(
		wsUrl,
		options.WebSocketImpl,
	);
	const taskApiMethods = createTaskApiMethods(requestWithBase);

	return {
		...boardApiMethods,
		...commandStreamApiMethods,
		async getHealth(requestOptions) {
			const payload = await requestWithBase("/health", "GET", requestOptions);
			return parseHealthResponse(payload);
		},
		async listTokenUsage(requestOptions) {
			const payload = await requestWithBase(
				"/api/token-usage",
				"GET",
				requestOptions,
			);
			return parseServerList.tokenUsage(payload);
		},
		async listJobs(requestOptions) {
			const payload = await requestWithBase("/api/jobs", "GET", requestOptions);
			return parseServerList.jobs(payload);
		},
		async listAgents(requestOptions) {
			const payload = await requestWithBase(
				"/api/agents",
				"GET",
				requestOptions,
			);
			return parseServerList.agents(payload);
		},
		async updateAgent(agentId, request, requestOptions) {
			const payload = await requestWithBase(
				`/api/agents/${encodePathSegment(agentId)}`,
				"PATCH",
				requestOptions,
				request,
			);
			return parseAgentRecord(payload);
		},
		async listSkills(requestOptions) {
			const payload = await requestWithBase(
				"/api/skills",
				"GET",
				requestOptions,
			);
			return parseServerList.skills(payload);
		},
		async listCommandHistory(requestOptions) {
			const payload = await requestWithBase(
				"/api/command-history",
				"GET",
				requestOptions,
			);
			return parseServerList.commandHistory(payload);
		},
		listBoardTasks: taskApiMethods.listBoardTasks,
		getBoardTask: taskApiMethods.getBoardTask,
		createTask: taskApiMethods.createTaskFromChat,
		createBoardTask: taskApiMethods.createBoardTask,
		updateBoardTask: taskApiMethods.updateBoardTask,
		deleteBoardTask: taskApiMethods.deleteBoardTask,
	};
}

function deriveWsUrl(baseUrl: string): string {
	if (!baseUrl) {
		return "/api/cli/stream";
	}
	if (baseUrl.startsWith("http://")) {
		return `${baseUrl.replace(/^http:\/\//, "ws://")}/api/cli/stream`;
	}
	if (baseUrl.startsWith("https://")) {
		return `${baseUrl.replace(/^https:\/\//, "wss://")}/api/cli/stream`;
	}
	return `${baseUrl}/api/cli/stream`;
}
