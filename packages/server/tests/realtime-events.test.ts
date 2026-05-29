import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { createRealtimeEventBus } from "../src/realtime";
import {
	bindRealtimeEventsClient,
	shouldHandleRealtimeUpgrade,
} from "../src/ws/realtime-events";
import type { RealtimeEventsSocket } from "../src/ws/types/realtime-events.types";

describe("realtime events", () => {
	it("broadcasts serialized event frames to connected websocket clients", () => {
		const bus = createRealtimeEventBus(
			() => "2026-05-16T00:00:00.000Z",
			() => "event-1",
		);
		const client = new FakeRealtimeSocket(WebSocket.OPEN);

		bindRealtimeEventsClient(client, bus);
		bus.publish({
			type: "issue.created",
			issue: {
				id: "task-1",
				taskKey: "TASK-000001",
				projectId: null,
				title: "Task",
				content: "Body",
				priority: 1,
				status: "open",
				dueDate: null,
				creatorId: "owner-1",
				assigneeId: null,
				linkedPr: null,
				createdAt: "2026-05-16T00:00:00.000Z",
				updatedAt: "2026-05-16T00:00:00.000Z",
			},
		});

		expect(client.sent.map((message) => JSON.parse(message))).toEqual([
			{
				id: "event-1",
				emittedAt: "2026-05-16T00:00:00.000Z",
				type: "issue.created",
				issue: expect.objectContaining({ id: "task-1" }),
			},
		]);
	});

	it("matches only the configured websocket upgrade path", () => {
		expect(
			shouldHandleRealtimeUpgrade(request("/api/events"), "/api/events"),
		).toBe(true);
		expect(
			shouldHandleRealtimeUpgrade(request("/api/workflow"), "/api/events"),
		).toBe(false);
	});
});

function request(
	url: string,
): Parameters<typeof shouldHandleRealtimeUpgrade>[0] {
	return { url } as Parameters<typeof shouldHandleRealtimeUpgrade>[0];
}

class FakeRealtimeSocket extends EventEmitter implements RealtimeEventsSocket {
	readonly sent: string[] = [];

	constructor(public readyState: number) {
		super();
	}

	send(message: string): void {
		this.sent.push(message);
	}

	close(): void {
		this.readyState = WebSocket.CLOSED;
		this.emit("close");
	}
}
