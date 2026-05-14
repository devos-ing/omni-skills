export interface TokenUsageRecord {
	id: string;
	runId: string;
	stage: string;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	recordedAt: string;
}

export interface JobRecord {
	id: string;
	projectId: string;
	issueKey: string;
	stage: string;
	status: string;
	createdAt: string;
}

export interface AgentRecord {
	id: string;
	name: string;
	backend: string;
	model: string;
	createdAt: string;
}

export interface SkillRecord {
	id: string;
	name: string;
	description: string;
	source: string;
	updatedAt: string;
}

export interface CommandHistoryRecord {
	id: string;
	command: string;
	exitCode: number;
	executedAt: string;
}

export interface ReadRepositories {
	listTokenUsage(): Promise<TokenUsageRecord[]>;
	listJobs(): Promise<JobRecord[]>;
	listAgents(): Promise<AgentRecord[]>;
	listSkills(): Promise<SkillRecord[]>;
	listCommandHistory(): Promise<CommandHistoryRecord[]>;
}
