import { afterEach, describe, expect, it } from "bun:test";
import type { RealtimeEventPayload } from "../src/realtime";
import {
	createJsonRequest,
	createServerTestApp,
	waitForRealtimeEvent,
} from "./app-test-helpers";
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

describe("chat realtime routes", () => {
	it("does not duplicate default project created events", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const app = createServerTestApp(testDatabase.db, {
			realtimeEvents: { publish: (event) => events.push(event) },
			workspacePath: testDatabase.path,
		});

		await app(createJsonRequest("POST", "/api/chat/sessions", {}));
		expect(eventTypes(events)).toEqual([
			"project.created",
			"issue.created",
			"chat.session.created",
		]);

		events.length = 0;
		await app(createJsonRequest("POST", "/api/chat/sessions", {}));

		expect(eventTypes(events)).toEqual([
			"issue.created",
			"chat.session.created",
		]);
	});

	it("emits session and message events for chat mutations", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const app = createServerTestApp(testDatabase.db, {
			cliExecutor: {
				execute: async (request) => ({
					status: "succeeded",
					request,
					commandResult: {
						code: 0,
						stdout: JSON.stringify({
							status: "ready",
							task: {
								title: "Build it",
								description: "Build it",
							},
						}),
						stderr: "",
					},
				}),
				executeStream: async (request) => ({ status: "succeeded", request }),
				getHistory: () => [],
			},
			realtimeEvents: { publish: (event) => events.push(event) },
			workspacePath: testDatabase.path,
		});
		const created = await app(
			createJsonRequest("POST", "/api/chat/sessions", {}),
		);
		const session = (await created.json()) as { id: string };
		events.length = 0;

		await app(
			createJsonRequest("PATCH", `/api/chat/sessions/${session.id}`, {
				title: "Renamed",
			}),
		);
		expect(events).toMatchObject([
			{ type: "chat.session.updated", session: { title: "Renamed" } },
		]);

		events.length = 0;
		await app(
			createJsonRequest("POST", `/api/chat/sessions/${session.id}/messages`, {
				role: "assistant",
				content: "Ready",
			}),
		);
		expect(eventTypes(events)).toEqual([
			"chat.message.created",
			"chat.session.updated",
		]);

		events.length = 0;
		await app(
			createJsonRequest("POST", `/api/chat/sessions/${session.id}/send`, {
				content: "Build it",
			}),
		);
		await waitForRealtimeEvent(events, "chat.session.updated");
		expect(eventTypes(events)).toEqual([
			"chat.message.created",
			"chat.stream.started",
			"issue.updated",
			"chat.stream.delta",
			"chat.stream.completed",
			"chat.message.created",
			"chat.session.updated",
		]);
		expect(events).toMatchObject([
			{ type: "chat.message.created", message: { role: "user" } },
			{ type: "chat.stream.started", stream: { sessionId: session.id } },
			{ type: "issue.updated" },
			{
				type: "chat.stream.delta",
				stream: {
					delta: "Task TASK(owner-1)-1: Build it is ready for planning.",
				},
			},
			{ type: "chat.stream.completed", stream: { sessionId: session.id } },
			{ type: "chat.message.created", message: { role: "assistant" } },
			{ type: "chat.session.updated", session: { id: session.id } },
		]);
	});
});

function eventTypes(events: RealtimeEventPayload[]): string[] {
	return events.map((event) => event.type);
}
