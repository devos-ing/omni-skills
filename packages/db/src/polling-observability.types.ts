import type { ServerDb } from "./database.types";

export type PollingEventLevel = "info" | "warn" | "error";
export type PollingState =
	| "idle"
	| "running"
	| "success"
	| "error"
	| "stopped"
	| "skipped";

export interface PollingStatusCounts {
	issueCount?: number;
	staleRetryCount?: number;
	readyTaskCount?: number;
	dispatchCount?: number;
}

export interface PollingStatusInput {
	db: ServerDb;
	pollerId: string;
	sourceType: string;
	sourceId: string;
	projectId?: string | null;
	state: PollingState;
	intervalMs: number;
	counts?: PollingStatusCounts;
	consecutiveFailures?: number;
	lastError?: string | null;
	startedAt?: string | null;
	finishedAt?: string | null;
	successAt?: string | null;
	errorAt?: string | null;
	now?: () => string;
}

export interface PollingEventInput {
	db: ServerDb;
	pollerId: string;
	sourceType: string;
	sourceId: string;
	projectId?: string | null;
	level: PollingEventLevel;
	eventType: string;
	message: string;
	metadata?: Record<string, unknown>;
	now?: () => string;
	idFactory?: () => string;
}
