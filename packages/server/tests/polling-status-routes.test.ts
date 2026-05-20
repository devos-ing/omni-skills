import { afterEach, describe, expect, it } from "bun:test";
import {
	type ServerDatabase,
	pollingEventsTable,
	pollingStatusTable,
} from "devos-db";
import { createHandleRequest } from "../src/app";
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

describe("polling status route", () => {
	it("returns poller status and newest events first", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const db = testDatabase.db;
		await seedPollingRows(db);
		const app = createApp(db);

		const response = await app(
			new Request("http://localhost/api/polling/status"),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			pollers: [
				expect.objectContaining({
					id: "linear:project-1",
					sourceType: "linear",
					state: "success",
					lastIssueCount: 2,
					lastReadyTaskCount: 0,
				}),
			],
			events: [
				expect.objectContaining({
					id: "event-2",
					eventType: "cycle_completed",
					metadata: { cycle: 2 },
				}),
				expect.objectContaining({
					id: "event-1",
					eventType: "cycle_started",
					metadata: { cycle: 2 },
				}),
			],
		});
	});

	it("returns empty state and method errors", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);

		const empty = await app(new Request("http://localhost/api/polling/status"));
		expect(empty.status).toBe(200);
		expect(await empty.json()).toEqual({ pollers: [], events: [] });

		const method = await app(
			new Request("http://localhost/api/polling/status", { method: "POST" }),
		);
		expect(method.status).toBe(405);
	});
});

function createApp(db: ServerDatabase["db"]) {
	return createHandleRequest({
		cliExecutor: {
			execute: async (request) => ({ status: "succeeded", request }),
			getHistory: () => [],
		},
		db,
	});
}

async function seedPollingRows(db: ServerDatabase["db"]): Promise<void> {
	await db.insert(pollingStatusTable).values({
		id: "linear:project-1",
		sourceType: "linear",
		sourceId: "project-1",
		projectId: "project-1",
		state: "success",
		intervalMs: 30000,
		lastStartedAt: "2026-05-16T00:00:00.000Z",
		lastFinishedAt: "2026-05-16T00:00:01.000Z",
		lastSuccessAt: "2026-05-16T00:00:01.000Z",
		lastErrorAt: null,
		lastIssueCount: 2,
		lastStaleRetryCount: 1,
		lastReadyTaskCount: 0,
		lastDispatchCount: 0,
		consecutiveFailures: 0,
		lastError: null,
		updatedAt: "2026-05-16T00:00:01.000Z",
	});
	await db.insert(pollingEventsTable).values([
		{
			id: "event-1",
			pollerId: "linear:project-1",
			sourceType: "linear",
			sourceId: "project-1",
			projectId: "project-1",
			level: "info",
			eventType: "cycle_started",
			message: "started",
			metadata: '{"cycle":2}',
			createdAt: "2026-05-16T00:00:00.000Z",
		},
		{
			id: "event-2",
			pollerId: "linear:project-1",
			sourceType: "linear",
			sourceId: "project-1",
			projectId: "project-1",
			level: "info",
			eventType: "cycle_completed",
			message: "completed",
			metadata: '{"cycle":2}',
			createdAt: "2026-05-16T00:00:01.000Z",
		},
	]);
}
