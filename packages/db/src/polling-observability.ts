import { desc, eq, inArray } from "drizzle-orm";
import type {
	PollingEventInput,
	PollingStatusInput,
} from "./polling-observability.types";
import { pollingEventsTable } from "./schema/polling-events.schema";
import { pollingStatusTable } from "./schema/polling-status.schema";

const MAX_EVENTS_PER_POLLER = 500;

export async function recordPollingStatus(
	input: PollingStatusInput,
): Promise<void> {
	const now = input.now?.() ?? new Date().toISOString();
	const [existing] = await input.db
		.select()
		.from(pollingStatusTable)
		.where(eq(pollingStatusTable.id, input.pollerId));
	const counts = input.counts ?? {};
	await input.db
		.insert(pollingStatusTable)
		.values({
			id: input.pollerId,
			sourceType: input.sourceType,
			sourceId: input.sourceId,
			projectId: input.projectId ?? null,
			state: input.state,
			intervalMs: input.intervalMs,
			lastStartedAt: input.startedAt ?? existing?.lastStartedAt ?? null,
			lastFinishedAt: input.finishedAt ?? existing?.lastFinishedAt ?? null,
			lastSuccessAt: input.successAt ?? existing?.lastSuccessAt ?? null,
			lastErrorAt: input.errorAt ?? existing?.lastErrorAt ?? null,
			lastIssueCount: counts.issueCount ?? existing?.lastIssueCount ?? 0,
			lastStaleRetryCount:
				counts.staleRetryCount ?? existing?.lastStaleRetryCount ?? 0,
			lastReadyTaskCount:
				counts.readyTaskCount ?? existing?.lastReadyTaskCount ?? 0,
			lastDispatchCount:
				counts.dispatchCount ?? existing?.lastDispatchCount ?? 0,
			consecutiveFailures:
				input.consecutiveFailures ?? existing?.consecutiveFailures ?? 0,
			lastError:
				input.lastError !== undefined
					? input.lastError
					: (existing?.lastError ?? null),
			updatedAt: now,
		})
		.onConflictDoUpdate({
			target: pollingStatusTable.id,
			set: {
				sourceType: input.sourceType,
				sourceId: input.sourceId,
				projectId: input.projectId ?? null,
				state: input.state,
				intervalMs: input.intervalMs,
				lastStartedAt: input.startedAt ?? existing?.lastStartedAt ?? null,
				lastFinishedAt: input.finishedAt ?? existing?.lastFinishedAt ?? null,
				lastSuccessAt: input.successAt ?? existing?.lastSuccessAt ?? null,
				lastErrorAt: input.errorAt ?? existing?.lastErrorAt ?? null,
				lastIssueCount: counts.issueCount ?? existing?.lastIssueCount ?? 0,
				lastStaleRetryCount:
					counts.staleRetryCount ?? existing?.lastStaleRetryCount ?? 0,
				lastReadyTaskCount:
					counts.readyTaskCount ?? existing?.lastReadyTaskCount ?? 0,
				lastDispatchCount:
					counts.dispatchCount ?? existing?.lastDispatchCount ?? 0,
				consecutiveFailures:
					input.consecutiveFailures ?? existing?.consecutiveFailures ?? 0,
				lastError:
					input.lastError !== undefined
						? input.lastError
						: (existing?.lastError ?? null),
				updatedAt: now,
			},
		});
}

export async function recordPollingEvent(
	input: PollingEventInput,
): Promise<void> {
	const now = input.now?.() ?? new Date().toISOString();
	await input.db.insert(pollingEventsTable).values({
		id: input.idFactory?.() ?? crypto.randomUUID(),
		pollerId: input.pollerId,
		sourceType: input.sourceType,
		sourceId: input.sourceId,
		projectId: input.projectId ?? null,
		level: input.level,
		eventType: input.eventType,
		message: input.message,
		metadata: JSON.stringify(input.metadata ?? {}),
		createdAt: now,
	});
	await prunePollingEvents(input.db, input.pollerId);
}

async function prunePollingEvents(
	db: PollingEventInput["db"],
	pollerId: string,
): Promise<void> {
	const stale = await db
		.select({ id: pollingEventsTable.id })
		.from(pollingEventsTable)
		.where(eq(pollingEventsTable.pollerId, pollerId))
		.orderBy(desc(pollingEventsTable.createdAt))
		.offset(MAX_EVENTS_PER_POLLER);
	const ids = stale.map((row) => row.id);
	if (ids.length === 0) {
		return;
	}
	await db
		.delete(pollingEventsTable)
		.where(inArray(pollingEventsTable.id, ids));
}
