import { afterEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { boardTasksTable } from "devos-db";
import { WebSocket } from "ws";
import type { RealtimeEventPayload } from "../src/realtime";
import {
	DAEMON_EVENTS_PATH,
	bindDaemonEventsClient,
	shouldHandleDaemonEventsUpgrade,
} from "../src/ws/daemon-events";
import type { DaemonEventsSocket } from "../src/ws/daemon-events.types";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";
import { seedTaskRouteProject } from "./task-route-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("daemon events websocket", () => {
	it("publishes task.changed events from trusted reread DB state", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		await seedTaskRouteProject(testDatabase.db, "project-1");
		await seedTask(testDatabase, "implementing");
		const socket = bindTestSocket(testDatabase, events);

		socket.emitMessage(
			JSON.stringify({
				type: "task.changed",
				taskId: "task-1",
				issue: { id: "task-1", status: "untrusted" },
			}),
		);

		expect(JSON.parse(await socket.nextSend())).toEqual({
			type: "task.changed.ack",
			taskId: "task-1",
			status: "published",
		});
		expect(events).toEqual([
			expect.objectContaining({
				type: "issue.updated",
				issue: expect.objectContaining({
					id: "task-1",
					status: "implementing",
				}),
			}),
		]);
	});

	it("returns not_found when task.changed references a missing task", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const socket = bindTestSocket(testDatabase, events);

		socket.emitMessage(
			JSON.stringify({ type: "task.changed", taskId: "missing" }),
		);

		expect(JSON.parse(await socket.nextSend())).toEqual({
			type: "task.changed.ack",
			taskId: "missing",
			status: "not_found",
		});
		expect(events).toEqual([]);
	});

	it("rejects malformed frames without publishing realtime events", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const socket = bindTestSocket(testDatabase, events);

		socket.emitMessage(JSON.stringify({ type: "task.changed" }));

		expect(JSON.parse(await socket.nextSend())).toEqual({
			type: "error",
			error: "Malformed daemon event frame: taskId is required",
		});
		expect(events).toEqual([]);
	});

	it("only handles daemon event socket upgrade paths", () => {
		expect(
			shouldHandleDaemonEventsUpgrade(
				requestWithUrl("/daemon/events"),
				DAEMON_EVENTS_PATH,
			),
		).toBe(true);
		expect(
			shouldHandleDaemonEventsUpgrade(
				requestWithUrl("/api/events"),
				DAEMON_EVENTS_PATH,
			),
		).toBe(false);
	});
});

class FakeDaemonEventsSocket
	extends EventEmitter
	implements DaemonEventsSocket
{
	readyState: number = WebSocket.OPEN;
	readonly sent: string[] = [];
	private sendResolver: ((message: string) => void) | undefined;

	send(message: string): void {
		this.sent.push(message);
		this.sendResolver?.(message);
		this.sendResolver = undefined;
	}

	close(): void {
		this.readyState = WebSocket.CLOSED;
	}

	emitMessage(message: string): void {
		this.emit("message", message);
	}

	nextSend(): Promise<string> {
		const sent = this.sent[0];
		if (sent) {
			return Promise.resolve(sent);
		}
		return new Promise((resolve) => {
			this.sendResolver = resolve;
		});
	}
}

function bindTestSocket(
	database: DrizzleServerTestDatabase,
	events: RealtimeEventPayload[],
): FakeDaemonEventsSocket {
	const socket = new FakeDaemonEventsSocket();
	bindDaemonEventsClient(socket, {
		db: database.db,
		realtimeEvents: { publish: (event) => events.push(event) },
	});
	return socket;
}

async function seedTask(
	database: DrizzleServerTestDatabase,
	status: string,
): Promise<void> {
	await database.db.insert(boardTasksTable).values({
		id: "task-1",
		taskKey: "TASK-000001",
		projectId: "project-1",
		title: "Task 1",
		content: "Body",
		priority: 1,
		status,
		creatorId: "owner-1",
		dueDate: null,
		linkedPr: null,
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
}

function requestWithUrl(url: string): IncomingMessage {
	return { url } as IncomingMessage;
}
