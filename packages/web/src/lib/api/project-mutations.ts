"use client";

import {
	type QueryClient,
	type UseMutationResult,
	useMutation,
	useQueryClient,
} from "@tanstack/react-query";
import { sortWorkspaceProjects } from "./project-ordering";
import { serverStateQueryKeys } from "./query-keys";
import type { WorkspaceProjectRecord } from "./types/client.types";
import type {
	ProjectCreateMutationInput,
	ProjectUpdateMutationInput,
} from "./types/queries.types";
import { createWebApiClient } from "./web-client";

const apiClient = createWebApiClient();

export function useCreateProjectMutation(): UseMutationResult<
	WorkspaceProjectRecord,
	Error,
	ProjectCreateMutationInput
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["project", "create"] as const,
		mutationFn: (input) => apiClient.createProject(input),
		onSuccess: (project) => refreshCreatedProjectCache(queryClient, project),
	});
}

export function useUpdateProjectMutation(): UseMutationResult<
	WorkspaceProjectRecord,
	Error,
	ProjectUpdateMutationInput
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["project", "update"] as const,
		mutationFn: ({ projectId, project }) =>
			apiClient.updateProject(projectId, project),
		onSuccess: (project) => refreshUpdatedProjectCache(queryClient, project),
	});
}

export async function refreshCreatedProjectCache(
	queryClient: Pick<QueryClient, "setQueryData" | "invalidateQueries">,
	project: WorkspaceProjectRecord,
): Promise<void> {
	queryClient.setQueryData<WorkspaceProjectRecord[] | undefined>(
		serverStateQueryKeys.workspaceProjects(project.workspaceId),
		(current) =>
			sortWorkspaceProjects(current ? [...current, project] : [project]),
	);
	await queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.workspaceProjects(project.workspaceId),
	});
}

export async function refreshUpdatedProjectCache(
	queryClient: Pick<QueryClient, "setQueryData" | "invalidateQueries">,
	project: WorkspaceProjectRecord,
): Promise<void> {
	queryClient.setQueryData<WorkspaceProjectRecord[] | undefined>(
		serverStateQueryKeys.workspaceProjects(project.workspaceId),
		(current) =>
			sortWorkspaceProjects(
				current?.map((entry) =>
					entry.id === project.id ? project : entry,
				) ?? [project],
			),
	);
	await queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.workspaceProjects(project.workspaceId),
	});
	await queryClient.invalidateQueries({
		queryKey: serverStateQueryKeys.projectBoard(
			project.workspaceId,
			project.id,
		),
	});
}
