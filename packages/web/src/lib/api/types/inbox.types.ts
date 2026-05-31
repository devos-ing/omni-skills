export interface InboxMessageScope {
	workspaceId: string;
	userId: string;
	runId: string;
}

export interface InboxMessageRecord extends InboxMessageScope {
	id: string;
	source: string;
	kind: string;
	body: string;
	taskId: string | null;
	agentId: string | null;
	metadata: Record<string, unknown> | null;
	createdAt: string;
}
