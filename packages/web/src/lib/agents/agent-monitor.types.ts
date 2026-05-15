export interface AgentHealthViewModel {
	status: "loading" | "healthy" | "error";
	summary: string;
}

export type AgentRuntimeStatus = "loading" | "ready" | "empty" | "error";

export interface AgentRuntimeTabViewModel {
	id: string;
	name: string;
	runtimeLabel: string;
	model: string;
}

export interface AgentRuntimeTabsViewModel {
	status: AgentRuntimeStatus;
	summary: string;
	tabs: AgentRuntimeTabViewModel[];
}
