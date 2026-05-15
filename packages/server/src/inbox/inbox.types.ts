export interface InboxMessageScope {
	workspaceId: string;
	userId: string;
	runId: string;
}

export interface InboxMessageMetadata {
	[key: string]: unknown;
}

export interface InboxMessageRecord extends InboxMessageScope {
	id: string;
	source: string;
	kind: string;
	body: string;
	taskId: string | null;
	agentId: string | null;
	metadata: InboxMessageMetadata | null;
	createdAt: string;
}

export interface CreateInboxMessageInput extends InboxMessageScope {
	source: string;
	kind: string;
	body: string;
	taskId?: string | null;
	agentId?: string | null;
	metadata?: InboxMessageMetadata | null;
	createdAt?: string;
}

export interface InboxRepository {
	createInboxMessage(
		input: CreateInboxMessageInput,
	): Promise<InboxMessageRecord>;
	listInboxMessages(scope: InboxMessageScope): Promise<InboxMessageRecord[]>;
}
