import type {
	AgentUpdateRequest,
	ProjectCreateRequest,
	ProjectUpdateRequest,
} from "./client.types";
import type { InboxMessageScope } from "./client.types";

export interface ServerStateQueryOptions {
	enabled?: boolean;
	refetchIntervalMs?: number | false;
}

export interface TaskCreateMutationInput {
	request: string;
	projectId?: string;
	answers?: Array<{ question: string; answer: string }>;
}

export interface BoardTaskMutationInput {
	projectId?: string | null;
	title: string;
	content: string;
	priority: number;
	status: string;
	creatorId: string;
	assigneeId?: string | null;
	dueDate?: string | null;
	linkedPr?: string | null;
}

export interface BoardTaskUpdateMutationInput {
	taskId: string;
	task: Partial<BoardTaskMutationInput>;
}

export type ProjectCreateMutationInput = ProjectCreateRequest;

export interface ProjectUpdateMutationInput {
	projectId: string;
	project: ProjectUpdateRequest;
}

export interface AgentUpdateMutationInput {
	agentId: string;
	agent: AgentUpdateRequest;
}

export type InboxMessagesQueryInput = InboxMessageScope;
