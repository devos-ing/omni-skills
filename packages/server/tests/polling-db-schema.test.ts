import { afterEach, describe, expect, it } from "bun:test";
import { eq } from "drizzle-orm";
import {
	type NewPollingEventRow,
	type NewPollingStatusRow,
	pollingEventsTable,
	pollingStatusTable,
} from "../src/db";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("polling observability schema", () => {
	it("stores current poller status and recent polling events", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const { db } = testDatabase;
		const status: NewPollingStatusRow = {
			id: "linear:default",
			sourceType: "linear",
			sourceId: "default",
			projectId: "default",
			state: "success",
			intervalMs: 30000,
			lastStartedAt: "2026-05-16 00:00:00",
			lastFinishedAt: "2026-05-16 00:00:01",
			lastSuccessAt: "2026-05-16 00:00:01",
			lastErrorAt: null,
			lastIssueCount: 1,
			lastStaleRetryCount: 0,
			lastReadyTaskCount: 0,
			lastDispatchCount: 0,
			consecutiveFailures: 0,
			lastError: null,
			updatedAt: "2026-05-16 00:00:01",
		};
		const event: NewPollingEventRow = {
			id: "event-1",
			pollerId: status.id,
			sourceType: status.sourceType,
			sourceId: status.sourceId,
			projectId: status.projectId,
			level: "info",
			eventType: "cycle_completed",
			message: "Linear polling cycle completed",
			metadata: '{"cycle":1}',
			createdAt: "2026-05-16 00:00:01",
		};

		await db.insert(pollingStatusTable).values(status);
		await db.insert(pollingEventsTable).values(event);

		const [statusRow] = await db
			.select()
			.from(pollingStatusTable)
			.where(eq(pollingStatusTable.id, status.id));
		const [eventRow] = await db
			.select()
			.from(pollingEventsTable)
			.where(eq(pollingEventsTable.id, event.id));
		expect(statusRow).toEqual({ ...status, projectId: status.projectId ?? null });
		expect(eventRow).toEqual({ ...event, projectId: event.projectId ?? null });
	});
});
