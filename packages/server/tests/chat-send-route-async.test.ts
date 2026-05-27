import { afterEach, describe, expect, it } from "bun:test";
import type { RealtimeEventPayload } from "../src/realtime";
import {
	createJsonRequest,
	createServerTestApp,
	realtimeEventTypes,
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

describe("chat send route async response", () => {
	it("acknowledges the user message before task intake completes", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const intakeStarted = deferred<void>();
		const intakeGate = deferred<void>();
		const app = createServerTestApp(testDatabase.db, {
			cliExecutor: {
				execute: async (request) => {
					intakeStarted.resolve();
					await intakeGate.promise;
					return {
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
					};
				},
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

		const responsePromise = Promise.resolve(
			app(
				createJsonRequest("POST", `/api/chat/sessions/${session.id}/send`, {
					content: "Build it",
				}),
			),
		);

		try {
			await intakeStarted.promise;
			const response = await responseWithin(responsePromise, 100);

			expect(response).toBeDefined();
			expect(response?.status).toBe(202);
			expect(realtimeEventTypes(events)).toEqual([
				"chat.message.created",
				"chat.stream.started",
			]);

			const body = (await response?.json()) as {
				messages: Array<{ content: string; role: string }>;
			};
			expect(body.messages).toMatchObject([
				{ content: "Build it", role: "user" },
			]);

			intakeGate.resolve();
			await waitForRealtimeEvent(events, "chat.session.updated");
			expect(realtimeEventTypes(events)).toEqual([
				"chat.message.created",
				"chat.stream.started",
				"issue.updated",
				"chat.stream.delta",
				"chat.stream.completed",
				"chat.message.created",
				"chat.session.updated",
			]);
		} finally {
			intakeGate.resolve();
			await responsePromise.catch(() => undefined);
		}
	});
});

function deferred<T>(): {
	promise: Promise<T>;
	resolve(value?: T | PromiseLike<T>): void;
} {
	let resolve: (value?: T | PromiseLike<T>) => void = () => undefined;
	const promise = new Promise<T>((innerResolve) => {
		resolve = (value) => innerResolve(value as T | PromiseLike<T>);
	});
	return { promise, resolve };
}

async function responseWithin(
	response: Promise<Response>,
	ms: number,
): Promise<Response | undefined> {
	return Promise.race([
		response,
		new Promise<undefined>((resolve) => setTimeout(resolve, ms)),
	]);
}
