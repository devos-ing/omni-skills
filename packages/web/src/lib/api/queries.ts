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
	ProjectBoardTaskRecord,
	SkillRecord,
	TaskCreateResponse,
	TokenUsageRecord,
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
const DEFAULT_POLL_INTERVAL_MS = 5000;

export const serverStateQueryKeys = {
	tokenUsage: ["server-state", "token-usage"] as const,
	jobs: ["server-state", "jobs"] as const,
	agents: ["server-state", "agents"] as const,
	skills: ["server-state", "skills"] as const,
	commandHistory: ["server-state", "command-history"] as const,
	boardTasks: ["server-state", "board-tasks"] as const,
	boardTask: (taskId: string) =>
		["server-state", "board-task", taskId] as const,
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
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useJobsQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<JobRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.jobs,
		queryFn: () => apiClient.listJobs(),
		enabled: options?.enabled,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useAgentsQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<AgentRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.agents,
		queryFn: () => apiClient.listAgents(),
		enabled: options?.enabled,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useSkillsQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<SkillRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.skills,
		queryFn: () => apiClient.listSkills(),
		enabled: options?.enabled,
		refetchInterval: resolveRefetchInterval(options),
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
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useBoardTasksQuery(
	options?: ServerStateQueryOptions,
): UseQueryResult<ProjectBoardTaskRecord[], Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.boardTasks,
		queryFn: () => apiClient.listBoardTasks(),
		enabled: options?.enabled,
		refetchInterval: resolveRefetchInterval(options),
	});
}

export function useBoardTaskQuery(
	taskId: string,
	options?: ServerStateQueryOptions,
): UseQueryResult<ProjectBoardTaskRecord, Error> {
	return useQuery({
		queryKey: serverStateQueryKeys.boardTask(taskId),
		queryFn: () => apiClient.getBoardTask(taskId),
		enabled: Boolean(taskId) && options?.enabled !== false,
		refetchInterval: resolveRefetchInterval(options),
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
				projectId: input.projectId || undefined,
				answers: input.answers,
			}),
	});
}

function resolveRefetchInterval(
	options?: ServerStateQueryOptions,
): number | false {
	return options?.refetchIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
}

export function useCreateBoardTaskMutation(): UseMutationResult<
	ProjectBoardTaskRecord,
	Error,
	BoardTaskMutationInput
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["board-task", "create"] as const,
		mutationFn: (input) => apiClient.createBoardTask(input),
		onSuccess: async (updatedTask) => {
			queryClient.setQueryData<ProjectBoardTaskRecord>(
				serverStateQueryKeys.boardTask(updatedTask.id),
				updatedTask,
			);
			queryClient.setQueryData<ProjectBoardTaskRecord[] | undefined>(
				serverStateQueryKeys.boardTasks,
				(current) =>
					current?.map((task) =>
						task.id === updatedTask.id ? updatedTask : task,
					),
			);
			await queryClient.invalidateQueries({
				queryKey: serverStateQueryKeys.boardTasks,
			});
			await queryClient.invalidateQueries({
				queryKey: serverStateQueryKeys.boardTask(updatedTask.id),
			});
		},
	});
}

export function useUpdateBoardTaskMutation(): UseMutationResult<
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
				queryKey: serverStateQueryKeys.boardTasks,
			});
		},
	});
}

export function useDeleteBoardTaskMutation(): UseMutationResult<
	ProjectBoardTaskRecord,
	Error,
	string
> {
	const queryClient = useQueryClient();
	return useMutation({
		mutationKey: ["board-task", "delete"] as const,
		mutationFn: (taskId) => apiClient.deleteBoardTask(taskId),
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: serverStateQueryKeys.boardTasks,
			});
		},
	});
}
