export interface RuntimeAgentSummary {
	id: string;
	name: string;
	backend: string;
	model: string;
	concurrency: number;
	owner: string;
	updatedAt: string;
}

export interface RuntimeSummary {
	id: string;
	label: string;
	agentCount: number;
	totalConcurrency: number;
	backendLabels: string[];
	models: string[];
	owners: string[];
	updatedAt: string;
	agents: RuntimeAgentSummary[];
}
