import { type UseQueryResult, useQuery } from "@tanstack/react-query";

import {
	type AgentRecord,
	type HealthResponse,
	createWebApiClient,
} from "@/lib/api";

const apiClient = createWebApiClient();

export const agentMonitorQueryKeys = {
	health: ["agent-monitor", "health"] as const,
	runtimes: ["agent-monitor", "runtimes"] as const,
};

export function useAgentHealthQuery(): UseQueryResult<HealthResponse, Error> {
	return useQuery({
		queryKey: agentMonitorQueryKeys.health,
		queryFn: ({ signal }) => apiClient.getHealth({ signal }),
		refetchInterval: 30_000,
	});
}

export function useAgentRuntimesQuery(): UseQueryResult<AgentRecord[], Error> {
	return useQuery({
		queryKey: agentMonitorQueryKeys.runtimes,
		queryFn: ({ signal }) => apiClient.listAgents({ signal }),
		refetchInterval: 30_000,
	});
}
