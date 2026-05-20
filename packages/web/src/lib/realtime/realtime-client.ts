"use client";

import type { WorkspaceProjectRecord } from "../api";
import { parseInboxMessageRecord } from "../api/inbox-client";
import { parseProjectBoardTaskRecord } from "../api/task-client";
import type {
	RealtimeEvent,
	RealtimeSubscription,
} from "./realtime-events.types";

const DEFAULT_REALTIME_URL = "/api/events";
const RECONNECT_DELAYS_MS = [1000, 2000, 5000] as const;

export interface RealtimeClientOptions {
	url?: string;
	WebSocketImpl?: typeof WebSocket;
	onEvent(event: RealtimeEvent): void;
	onStatus(status: "connecting" | "connected" | "disconnected"): void;
	onError(error: string): void;
}

export function subscribeToRealtimeEvents(
	options: RealtimeClientOptions,
): RealtimeSubscription {
	const WebSocketImpl = options.WebSocketImpl ?? WebSocket;
	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;
	let reconnectAttempt = 0;

	const connect = (): void => {
		options.onStatus("connecting");
		socket = new WebSocketImpl(resolveBrowserRealtimeUrl(options.url));
		socket.addEventListener("open", () => {
			reconnectAttempt = 0;
			options.onStatus("connected");
		});
		socket.addEventListener("message", (event) => {
			try {
				options.onEvent(parseRealtimeEvent(String(event.data)));
			} catch (error) {
				options.onError(error instanceof Error ? error.message : String(error));
			}
		});
		socket.addEventListener("error", () => {
			options.onError("Realtime websocket failed");
		});
		socket.addEventListener("close", () => {
			options.onStatus("disconnected");
			if (!closed) {
				scheduleReconnect();
			}
		});
	};

	const scheduleReconnect = (): void => {
		const delay =
			RECONNECT_DELAYS_MS[
				Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
			];
		reconnectAttempt += 1;
		reconnectTimer = setTimeout(connect, delay);
	};

	connect();

	return {
		close(): void {
			closed = true;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
			socket?.close();
		},
	};
}

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

export function resolveBrowserRealtimeUrl(url = DEFAULT_REALTIME_URL): string {
	if (typeof window === "undefined" || !url.startsWith("/")) {
		return url;
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${url}`;
}

function parseProject(value: unknown): WorkspaceProjectRecord {
	const row = assertRecord(value);
	return {
		id: readString(row, "id"),
		boardId: readString(row, "boardId"),
		workspaceId: readString(row, "workspaceId"),
		externalProjectId: readNullableString(row, "externalProjectId"),
		name: readString(row, "name"),
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
