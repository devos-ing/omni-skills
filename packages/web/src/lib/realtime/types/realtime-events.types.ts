import type {
	ChatMessageRecord,
	ChatSessionRecord,
	InboxMessageRecord,
	ProjectBoardTaskRecord,
	WorkspaceProjectRecord,
} from "../../api";

export type RealtimeConnectionStatus =
	| "idle"
	| "connecting"
	| "connected"
	| "disconnected";

export type RealtimeIssueEventType =
	| "issue.created"
	| "issue.updated"
	| "issue.deleted";

export type RealtimeProjectEventType =
	| "project.created"
	| "project.updated"
	| "project.deleted";

export type RealtimeChatEventType =
	| "chat.session.created"
	| "chat.session.updated"
	| "chat.message.created";

export interface WorkflowProgressEvent {
	schema: "devos.workflow.stream.v1";
	emittedAt: string;
	kind: string;
	[key: string]: unknown;
}

export interface RealtimeTaskExecutionEventRecord {
	taskId: string;
	executionLogId: string;
	event: WorkflowProgressEvent;
}

export interface RealtimePollingEventRecord {
	pollerId: string;
	eventType: string;
	level: string;
	message: string;
}

export type RealtimeEvent =
	| {
			id: string;
			emittedAt: string;
			type: RealtimeIssueEventType;
			issue: ProjectBoardTaskRecord;
	  }
	| {
			id: string;
			emittedAt: string;
			type: RealtimeProjectEventType;
			project: WorkspaceProjectRecord;
	  }
	| {
			id: string;
			emittedAt: string;
			type: "inbox.message.created";
			message: InboxMessageRecord;
	  }
	| {
			id: string;
			emittedAt: string;
			type: "chat.session.created" | "chat.session.updated";
			session: ChatSessionRecord;
	  }
	| {
			id: string;
			emittedAt: string;
			type: "chat.message.created";
			message: ChatMessageRecord;
	  }
	| {
			id: string;
			emittedAt: string;
			type: "task.execution.event";
			execution: RealtimeTaskExecutionEventRecord;
	  }
	| {
			id: string;
			emittedAt: string;
			type: "polling.event";
			polling: RealtimePollingEventRecord;
	  };

export interface RealtimeSubscription {
	close(): void;
}

export type RealtimeIssueEvent = Extract<
	RealtimeEvent,
	{ type: RealtimeIssueEventType }
>;

export type RealtimeProjectEvent = Extract<
	RealtimeEvent,
	{ type: RealtimeProjectEventType }
>;

export type RealtimeChatSessionEvent = Extract<
	RealtimeEvent,
	{ type: "chat.session.created" | "chat.session.updated" }
>;
