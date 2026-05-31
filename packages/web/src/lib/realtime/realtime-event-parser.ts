import type { WorkspaceProjectRecord } from "../api";
import {
	parseChatMessageRecord,
	parseChatSessionRecord,
} from "../api/chat-client";
import { parseInboxMessageRecord } from "../api/inbox-client";
import { parseProjectBoardTaskRecord } from "../api/task-client";
import type { RealtimeEvent } from "./types/realtime-events.types";

export function parseRealtimeEvent(payload: string): RealtimeEvent {
	const parsed = JSON.parse(payload) as unknown;
	const row = assertRecord(parsed);
	const id = readString(row, "id");
	const emittedAt = readString(row, "emittedAt");
	const type = readString(row, "type");
	if (type.startsWith("issue.")) {
		return {
			id,
			emittedAt,
			type: readEventType(type, [
				"issue.created",
				"issue.updated",
				"issue.deleted",
			]),
			issue: parseProjectBoardTaskRecord(row.issue),
		};
	}
	if (type.startsWith("project.")) {
		return {
			id,
			emittedAt,
			type: readEventType(type, [
				"project.created",
				"project.updated",
				"project.deleted",
			]),
			project: parseProject(row.project),
		};
	}
	if (type.startsWith("chat.session.")) {
		return {
			id,
			emittedAt,
			type: readEventType(type, [
				"chat.session.created",
				"chat.session.updated",
			]),
			session: parseChatSessionRecord(row.session),
		};
	}
	if (type === "chat.message.created") {
		return {
			id,
			emittedAt,
			type,
			message: parseChatMessageRecord(row.message),
		};
	}
	if (type.startsWith("chat.stream.")) {
		return parseChatStreamEvent(id, emittedAt, type, row.stream);
	}
	if (type === "inbox.message.created") {
		return {
			id,
			emittedAt,
			type,
			message: parseInboxMessageRecord(row.message),
		};
	}
	if (type === "task.execution.event") {
		return {
			id,
			emittedAt,
			type,
			execution: parseTaskExecutionEvent(row.execution),
		};
	}
	if (type === "polling.event") {
		return {
			id,
			emittedAt,
			type,
			polling: parsePollingEvent(row.polling),
		};
	}
	throw new Error("Invalid realtime event type");
}

function parseChatStreamEvent(
	id: string,
	emittedAt: string,
	type: string,
	value: unknown,
): RealtimeEvent {
	const row = assertRecord(value);
	const runId = readString(row, "runId");
	const sessionId = readString(row, "sessionId");
	if (type === "chat.stream.started") {
		return {
			id,
			emittedAt,
			type,
			stream: {
				runId,
				sessionId,
				status: readEventType(readString(row, "status"), ["loading"]),
				userMessageId: readString(row, "userMessageId"),
			},
		};
	}
	if (type === "chat.stream.delta") {
		return {
			id,
			emittedAt,
			type,
			stream: { runId, sessionId, delta: readString(row, "delta") },
		};
	}
	if (type === "chat.stream.completed") {
		return {
			id,
			emittedAt,
			type,
			stream: {
				runId,
				sessionId,
				message: parseChatMessageRecord(row.message),
			},
		};
	}
	if (type === "chat.stream.error") {
		return {
			id,
			emittedAt,
			type,
			stream: { runId, sessionId, error: readString(row, "error") },
		};
	}
	throw new Error("Invalid realtime event type");
}

function parseProject(value: unknown): WorkspaceProjectRecord {
	const row = assertRecord(value);
	return {
		id: readString(row, "id"),
		boardId: readString(row, "boardId"),
		workspaceId: readString(row, "workspaceId"),
		externalProjectId: readNullableString(row, "externalProjectId"),
		name: readString(row, "name"),
		emoji: readNullableString(row, "emoji"),
		description: readNullableString(row, "description"),
		repoOwner: readNullableString(row, "repoOwner"),
		repoName: readNullableString(row, "repoName"),
		baseBranch: readNullableString(row, "baseBranch"),
		localFolder: readNullableString(row, "localFolder"),
		lead: readNullableString(row, "lead"),
		category: readNullableString(row, "category"),
		priority: readNullableNumber(row, "priority"),
		createdAt: readString(row, "createdAt"),
		updatedAt: readString(row, "updatedAt"),
	};
}

function parseTaskExecutionEvent(value: unknown) {
	const row = assertRecord(value);
	return {
		taskId: readString(row, "taskId"),
		executionLogId: readString(row, "executionLogId"),
		event: parseWorkflowProgressEvent(row.event),
	};
}

function parsePollingEvent(value: unknown) {
	const row = assertRecord(value);
	return {
		pollerId: readString(row, "pollerId"),
		eventType: readString(row, "eventType"),
		level: readString(row, "level"),
		message: readString(row, "message"),
	};
}

function parseWorkflowProgressEvent(value: unknown) {
	const row = assertRecord(value);
	if (readString(row, "schema") !== "devos.workflow.stream.v1") {
		throw new Error("Invalid workflow progress event schema");
	}
	readString(row, "emittedAt");
	readString(row, "kind");
	return row as {
		schema: "devos.workflow.stream.v1";
		emittedAt: string;
		kind: string;
		[key: string]: unknown;
	};
}

function assertRecord(value: unknown): Record<string, unknown> {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error("Invalid realtime event payload");
	}
	return value as Record<string, unknown>;
}

function readString(record: Record<string, unknown>, key: string): string {
	const value = record[key];
	if (typeof value !== "string") {
		throw new Error(`Invalid realtime event field '${key}'`);
	}
	return value;
}

function readNullableString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	const value = record[key];
	if (value === null || typeof value === "string") {
		return value;
	}
	throw new Error(`Invalid realtime event field '${key}'`);
}

function readNullableNumber(
	record: Record<string, unknown>,
	key: string,
): number | null {
	const value = record[key];
	if (value === null || typeof value === "number") {
		return value;
	}
	throw new Error(`Invalid realtime event field '${key}'`);
}

function readEventType<const T extends string>(
	value: string,
	allowed: readonly T[],
): T {
	if (allowed.includes(value as T)) {
		return value as T;
	}
	throw new Error("Invalid realtime event type");
}
