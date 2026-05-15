export interface InboxMessageScopeInput {
	workspaceId: string;
	userId: string;
	runId: string;
}

export interface CreateInboxMessagePayload extends InboxMessageScopeInput {
	source: string;
	kind: string;
	body: string;
	taskId?: string | null;
	agentId?: string | null;
	metadata?: Record<string, unknown> | null;
	createdAt?: string;
}
