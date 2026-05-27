import { afterEach, describe, expect, it } from "bun:test";
import {
	boardTasksTable,
	chatMessagesTable,
	chatSessionsTable,
} from "devos-db";
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

describe("legacy chat sessions", () => {
	it("creates and attaches an issue for sessions without task ids", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const app = createServerTestApp(testDatabase.db, {
			cliExecutor: {
				execute: async (request) => ({
					status: "succeeded",
					request,
					commandResult: {
						code: 0,
						stdout:
							'{"status":"ready","task":{"title":"Legacy chat request","description":"Legacy chat request"}}\n',
						stderr: "",
					},
				}),
				executeStream: async (request) => ({ status: "succeeded", request }),
				getHistory: () => [],
			},
			realtimeEvents: { publish: (event) => events.push(event) },
			workspacePath: testDatabase.path,
		});
		await testDatabase.db.insert(chatSessionsTable).values({
			id: "legacy-session",
			workspaceId: "owner-1",
			projectId: null,
			taskId: null,
			title: "Untitled",
			pendingRequest: null,
			pendingQuestions: null,
			createdAt: "2026-05-13T00:00:00.000Z",
			updatedAt: "2026-05-13T00:00:00.000Z",
		});

		const response = await app(
			createJsonRequest("POST", "/api/chat/sessions/legacy-session/send", {
				content: "Legacy chat request",
			}),
		);

		expect(response.status).toBe(202);
		const body = (await response.json()) as {
			messages: Array<{ taskId: string | null }>;
			session: { projectId: string | null; taskId: string | null };
		};
		expect(body.session.projectId).toBe("default");
		expect(body.session.taskId).toBeTruthy();
		const taskId = body.session.taskId;
		if (!taskId) {
			throw new Error("Expected legacy session to have a task id");
		}
		expect(body.messages[0]?.taskId).toBe(taskId);

		const tasks = await testDatabase.db.select().from(boardTasksTable);
		const messages = await testDatabase.db.select().from(chatMessagesTable);
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.id).toBe(taskId);
		expect(messages[0]?.taskId).toBe(taskId);
		await waitForRealtimeEvent(events, "chat.session.updated");
	});
});
