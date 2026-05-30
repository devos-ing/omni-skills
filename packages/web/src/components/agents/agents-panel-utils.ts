import type { AgentRecord } from "@/lib/api";

import { formatRuntimeLabel } from "../runtimes/runtimes-panel-utils";
import type {
	AgentCounts,
	AgentRowViewModel,
	AgentStatusFilter,
} from "./types/agent-list.types";

export const AGENT_STATUS_FILTERS: AgentStatusFilter[] = [
	"all",
	"online",
	"offline",
];

export function deriveAgentRows(agents: AgentRecord[]): AgentRowViewModel[] {
	return agents.map((agent) => {
		const status = agent.status === "offline" ? "offline" : "online";
		const statusLabel = status === "online" ? "Online" : "Offline";
		const activeCount = agent.activity.length;
		const activityLabel = agent.activity[0] ?? "No activity";
		const reasoningLabel = agent.reasoningEffort
			? `Reasoning ${agent.reasoningEffort}`
			: "Reasoning default";
		const runtimeLabel = runtimeLabelForAgent(agent);
		const workloadLabel =
			activeCount > 0
				? `${activeCount} active / ${agent.concurrency} capacity`
				: "Idle";

		return {
			id: agent.id,
			name: agent.name,
			description: agent.description,
			owner: agent.owner,
			status,
			statusLabel,
			statusTone: status === "online" ? "bg-emerald-400" : "bg-zinc-500",
			workloadLabel,
			runtimeLabel,
			activityLabel,
			runCount: agent.recentWork.length,
			modelLabel: agent.model,
			reasoningLabel,
			searchText: [
				agent.id,
				agent.name,
				agent.description,
				agent.owner,
				agent.runtime,
				agent.backend,
				agent.model,
				agent.reasoningEffort ?? "",
				statusLabel,
			]
				.join(" ")
				.toLowerCase(),
			record: agent,
		};
	});
}

export function filterAgentRows(
	rows: AgentRowViewModel[],
	searchTerm: string,
	statusFilter: AgentStatusFilter,
): AgentRowViewModel[] {
	const normalizedSearch = searchTerm.trim().toLowerCase();
	return rows.filter((row) => {
		const matchesStatus = statusFilter === "all" || row.status === statusFilter;
		const matchesSearch =
			normalizedSearch.length === 0 ||
			row.searchText.includes(normalizedSearch);
		return matchesStatus && matchesSearch;
	});
}

export function summarizeAgentCounts(rows: AgentRowViewModel[]): AgentCounts {
	return rows.reduce<AgentCounts>(
		(counts, row) => ({
			all: counts.all + 1,
			offline: counts.offline + (row.status === "offline" ? 1 : 0),
			online: counts.online + (row.status === "online" ? 1 : 0),
		}),
		{ all: 0, offline: 0, online: 0 },
	);
}

function runtimeLabelForAgent(agent: AgentRecord): string {
	const backendLabel = formatRuntimeLabel(agent.backend);
	const runtime = agent.runtime.trim();
	if (
		!runtime ||
		runtime.toLowerCase() === agent.backend.trim().toLowerCase()
	) {
		return backendLabel;
	}
	return `${backendLabel} (${runtime})`;
}
