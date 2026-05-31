"use client";

import { type UseQueryResult, useQuery } from "@tanstack/react-query";
import { serverStateQueryKeys } from "./query-keys";
import type {
	GitHubRepositoriesResponse,
	InboxMessageRecord,
	InboxMessageScope,
	ProjectBoardRecord,
	WorkspaceProjectRecord,
} from "./types/client.types";
import type { ServerStateQueryOptions } from "./types/queries.types";
import { createWebApiClient } from "./web-client";

const apiClient = createWebApiClient();
const DEFAULT_POLL_INTERVAL_MS = 5000;

export function useWorkspaceProjectsQuery(
	workspaceId: string,
	options?: ServerStateQueryOptions,
): UseQueryResult<WorkspaceProjectRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.workspaceProjects(workspaceId),
		queryFn: () => apiClient.listWorkspaceProjects(workspaceId),
		enabled: Boolean(workspaceId) && options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useProjectBoardQuery(
	workspaceId: string,
	projectId: string,
	options?: ServerStateQueryOptions,
): UseQueryResult<ProjectBoardRecord, Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.projectBoard(workspaceId, projectId),
		queryFn: () => apiClient.getProjectBoard(workspaceId, projectId),
		enabled:
			Boolean(workspaceId) && Boolean(projectId) && options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useGitHubRepositoriesQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<GitHubRepositoriesResponse, Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.gitHubRepositories,
		queryFn: () => apiClient.listGitHubRepositories(),
		enabled: options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useInboxMessagesQuery(
	scope: InboxMessageScope,
	options?: ServerStateQueryOptions,
): UseQueryResult<InboxMessageRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.inboxMessages(scope),
		queryFn: () => apiClient.listInboxMessages(scope),
		enabled:
			Boolean(scope.workspaceId) &&
			Boolean(scope.userId) &&
			Boolean(scope.runId) &&
			options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
	});
}

function resolveRefetchInterval(
	options?: ServerStateQueryOptions,
): number | false {
	return options?.refetchIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
}
