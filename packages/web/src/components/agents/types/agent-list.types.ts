import type {
	AgentRecord,
	AgentStatus,
	SettingsReasoningEffort,
} from "@/lib/api";

export type AgentStatusFilter = "all" | AgentStatus;

export interface AgentCounts {
	all: number;
	offline: number;
	online: number;
}

export interface AgentRowViewModel {
	id: string;
	name: string;
	description: string;
	owner: string;
	status: AgentStatus;
	statusLabel: string;
	statusTone: string;
	workloadLabel: string;
	runtimeLabel: string;
	activityLabel: string;
	runCount: number;
	modelLabel: string;
	reasoningLabel: string;
	searchText: string;
	record: AgentRecord;
}

export interface AgentModelEditOptions {
	models: string[];
	reasoningEfforts: SettingsReasoningEffort[];
}
