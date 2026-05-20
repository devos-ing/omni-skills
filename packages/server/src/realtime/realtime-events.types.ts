import type { BoardProjectRow, BoardTaskRow } from "devos-db";
import type { WorkflowProgressEvent } from "devos/features/server";
import type { InboxMessageRecord } from "../inbox";

export type RealtimeIssueEventType =
	| "issue.created"
	| "issue.updated"
	| "issue.deleted";

export type RealtimeProjectEventType =
	| "project.created"
	| "project.updated"
	| "project.deleted";

export type RealtimeInboxEventType = "inbox.message.created";

export interface RealtimeProjectRecord {
	id: string;
	boardId: string;
	workspaceId: string;
	externalProjectId: string | null;
	name: string;
	description: string | null;
	repoOwner: string | null;
	repoName: string | null;
	baseBranch: string | null;
	localFolder: string | null;
	lead: string | null;
	category: string | null;
	priority: number | null;
	createdAt: string;
	updatedAt: string;
}

export type RealtimeIssueRecord = BoardTaskRow;
export type RealtimeInboxMessageRecord = InboxMessageRecord;

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

export type RealtimeEventPayload =
	| {
			type: RealtimeIssueEventType;
			issue: RealtimeIssueRecord;
	  }
	| {
			type: RealtimeProjectEventType;
			project: RealtimeProjectRecord;
	  }
	| {
			type: "inbox.message.created";
			message: RealtimeInboxMessageRecord;
	  }
	| {
			type: "task.execution.event";
			execution: RealtimeTaskExecutionEventRecord;
	  }
	| {
			type: "polling.event";
			polling: RealtimePollingEventRecord;
	  };

export type RealtimeEvent = RealtimeEventPayload & {
	id: string;
	emittedAt: string;
};

export interface RealtimeEventPublisher {
	publish(event: RealtimeEventPayload): void;
}

export interface RealtimeEventBus extends RealtimeEventPublisher {
	subscribe(listener: (event: RealtimeEvent) => void): () => void;
}

export type RealtimeProjectSource = BoardProjectRow;
