"use client";

import {
	type UseMutationResult,
	type UseQueryResult,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import type {
	AgentRecord,
	CommandHistoryRecord,
	JobRecord,
	ProjectBoardRecord,
	ProjectBoardTaskRecord,
	SkillRecord,
	TaskCreateResponse,
	TokenUsageRecord,
	WorkspaceProjectRecord,
} from "./client.types";
import type {
	AgentUpdateMutationInput,
	BoardTaskMutationInput,
	BoardTaskUpdateMutationInput,
	ServerStateQueryOptions,
	TaskCreateMutationInput,
} from "./queries.types";
import { createWebApiClient } from "./web-client";

const apiClient = createWebApiClient();

export const serverStateQueryKeys = {
	tokenUsage: ["server-state", "token-usage"] as const,
	jobs: ["server-state", "jobs"] as const,
	agents: ["server-state", "agents"] as const,
	skills: ["server-state", "skills"] as const,
	commandHistory: ["server-state", "command-history"] as const,
	workspaceProjects: (workspaceId: string | null) =>
		["server-state", "workspace-projects", workspaceId] as const,
	projectBoard: (workspaceId: string | null, projectId: string | null) =>
		["server-state", "project-board", workspaceId, projectId] as const,
};

export const taskCreationMutationKeys = {
	createTask: ["task-creation", "create-task"] as const,
};

export const agentMutationKeys = {
	updateAgent: ["agents", "update-agent"] as const,
};

export function useTokenUsageQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<TokenUsageRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.tokenUsage,
		queryFn: () => apiClient.listTokenUsage(),
		enabled: options?.enabled,
	});
}

export function useJobsQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<JobRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.jobs,
		queryFn: () => apiClient.listJobs(),
		enabled: options?.enabled,
	});
}

export function useAgentsQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<AgentRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.agents,
		queryFn: () => apiClient.listAgents(),
		enabled: options?.enabled,
	});
}

export function useSkillsQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<SkillRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.skills,
		queryFn: () => apiClient.listSkills(),
		enabled: options?.enabled,
	});
}

export function useUpdateAgentMutation(): UseMutationResult<
	AgentRecord,
	Error,
	AgentUpdateMutationInput
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: agentMutationKeys.updateAgent,
		mutationFn: ({ agentId, agent }) => apiClient.updateAgent(agentId, agent),
		onSuccess: (updatedAgent) => {
			queryClient.setQueryData<AgentRecord[] | undefined>(
				serverStateQueryKeys.agents,
				(current) =>
					current?.map((agent) =>
						agent.id === updatedAgent.id ? updatedAgent : agent,
					),
			);
			queryClient.invalidateQueries({
				queryKey: serverStateQueryKeys.agents,
			});
		},
	});
}

export function useCommandHistoryQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<CommandHistoryRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.commandHistory,
		queryFn: () => apiClient.listCommandHistory(),
		enabled: options?.enabled,
	});
}

export function useCreateTaskMutation(): UseMutationResult<
	TaskCreateResponse,
	Error,
	TaskCreateMutationInput
> {
	return useMutation({
		mutationKey: taskCreationMutationKeys.createTask,
		mutationFn: (input) =>
			apiClient.createTask({
				request: input.request,
				projectId: input.projectId,
				answers: input.answers,
			}),
	});
}

export function useWorkspaceProjectsQuery(
	workspaceId: string | null,
	options?: ServerStateQueryOptions,
): UseQueryResult<WorkspaceProjectRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.workspaceProjects(workspaceId),
		queryFn: () => apiClient.listWorkspaceProjects(workspaceId ?? ""),
		enabled: Boolean(workspaceId) && options?.enabled !== false,
	});
}

export function useProjectBoardQuery(
	workspaceId: string | null,
	projectId: string | null,
	options?: ServerStateQueryOptions,
): UseQueryResult<ProjectBoardRecord, Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.projectBoard(workspaceId, projectId),
		queryFn: () =>
			apiClient.getProjectBoard(workspaceId ?? "", projectId ?? ""),
		enabled: Boolean(workspaceId && projectId) && options?.enabled !== false,
	});
}

export function useCreateBoardTaskMutation(
	workspaceId: string | null,
	projectId: string | null,
): UseMutationResult<ProjectBoardTaskRecord, Error, BoardTaskMutationInput> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["board-task", "create"] as const,
		mutationFn: (input) => apiClient.createBoardTask(input),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: serverStateQueryKeys.projectBoard(workspaceId, projectId),
			});
		},
	});
}

export function useUpdateBoardTaskMutation(
	workspaceId: string | null,
	projectId: string | null,
): UseMutationResult<
	ProjectBoardTaskRecord,
	Error,
	BoardTaskUpdateMutationInput
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["board-task", "update"] as const,
		mutationFn: (input) => apiClient.updateBoardTask(input.taskId, input.task),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: serverStateQueryKeys.projectBoard(workspaceId, projectId),
			});
		},
	});
}

export function useDeleteBoardTaskMutation(
	workspaceId: string | null,
	projectId: string | null,
): UseMutationResult<ProjectBoardTaskRecord, Error, string> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["board-task", "delete"] as const,
		mutationFn: (taskId) => apiClient.deleteBoardTask(taskId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: serverStateQueryKeys.projectBoard(workspaceId, projectId),
			});
		},
	});
}
