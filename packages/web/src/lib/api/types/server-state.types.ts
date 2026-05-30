import type { SettingsReasoningEffort } from "./settings.types";

export interface TokenUsageRecord {
	id: string;
	runId: string;
	taskId: string | null;
	taskExecutionLogId: string | null;
	stage: string;
	agentBackend: string | null;
	model: string | null;
	inputTokens: number;
	outputTokens: number;
	totalTokens: number;
	estimatedCostMicrousd: number | null;
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

export type AgentStatus = "offline" | "online";

export interface AgentRecord {
	id: string;
	name: string;
	description: string;
	logo: string;
	runtime: string;
	backend: string;
	model: string;
	reasoningEffort: SettingsReasoningEffort | null;
	status: AgentStatus;
	concurrency: number;
	owner: string;
	createdAt: string;
	updatedAt: string;
	skills: string[];
	recentWork: string[];
	activity: string[];
	instructions: string;
}

export interface AgentUpdateRequest {
	name?: string;
	description?: string;
	logo?: string;
	runtime?: string;
	backend?: string;
	model?: string;
	reasoningEffort?: SettingsReasoningEffort | null;
	status?: AgentStatus;
	concurrency?: number;
	owner?: string;
	createdAt?: string;
	updatedAt?: string;
	skills?: string[];
	recentWork?: string[];
	activity?: string[];
	instructions?: string;
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
