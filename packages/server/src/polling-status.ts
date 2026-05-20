import { desc } from "devos-db";
import {
	type ServerDatabase,
	pollingEventsTable,
	pollingStatusTable,
} from "devos-db";
import type {
	PollingEventRecord,
	PollingStatusRecord,
	PollingStatusResponse,
} from "./polling-status.types";

const EVENT_LIMIT = 100;

export async function listPollingStatus(
	db: ServerDatabase["db"],
): Promise<PollingStatusResponse> {
	const pollers = await db
		.select()
		.from(pollingStatusTable)
		.orderBy(desc(pollingStatusTable.updatedAt));
	const events = await db
		.select()
		.from(pollingEventsTable)
		.orderBy(desc(pollingEventsTable.createdAt))
		.limit(EVENT_LIMIT);
	return {
		pollers: pollers.map(mapPollingStatus),
		events: events.map(mapPollingEvent),
	};
}

function mapPollingStatus(row: typeof pollingStatusTable.$inferSelect) {
	return {
		id: row.id,
		sourceType: row.sourceType,
		sourceId: row.sourceId,
		projectId: row.projectId,
		state: row.state,
		intervalMs: row.intervalMs,
		lastStartedAt: row.lastStartedAt,
		lastFinishedAt: row.lastFinishedAt,
		lastSuccessAt: row.lastSuccessAt,
		lastErrorAt: row.lastErrorAt,
		lastIssueCount: row.lastIssueCount,
		lastStaleRetryCount: row.lastStaleRetryCount,
		lastReadyTaskCount: row.lastReadyTaskCount,
		lastDispatchCount: row.lastDispatchCount,
		consecutiveFailures: row.consecutiveFailures,
		lastError: row.lastError,
		updatedAt: row.updatedAt,
	} satisfies PollingStatusRecord;
}

function mapPollingEvent(row: typeof pollingEventsTable.$inferSelect) {
	return {
		id: row.id,
		pollerId: row.pollerId,
		sourceType: row.sourceType,
		sourceId: row.sourceId,
		projectId: row.projectId,
		level: row.level,
		eventType: row.eventType,
		message: row.message,
		metadata: parseMetadata(row.metadata),
		createdAt: row.createdAt,
	} satisfies PollingEventRecord;
}

function parseMetadata(value: string): Record<string, unknown> {
	try {
		const parsed = JSON.parse(value) as unknown;
		return parsed && typeof parsed === "object" && !Array.isArray(parsed)
			? (parsed as Record<string, unknown>)
			: {};
	} catch {
		return {};
	}
}
