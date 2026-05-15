import type { AgentUpdateRequest } from "./client.types";

export interface ServerStateQueryOptions {
	enabled?: boolean;
}

export interface TaskCreateMutationInput {
	request: string;
	projectId?: string;
	answers?: Array<{ question: string; answer: string }>;
}

export interface BoardTaskMutationInput {
	projectId: string;
	title: string;
	content: string;
	priority: number;
	status: string;
	creatorId: string;
	dueDate?: string | null;
	linkedPr?: string | null;
}

export interface BoardTaskUpdateMutationInput {
	taskId: string;
	task: Partial<BoardTaskMutationInput>;
}

export interface AgentUpdateMutationInput {
	agentId: string;
	agent: AgentUpdateRequest;
}
