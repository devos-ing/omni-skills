import { afterEach, describe, expect, it } from "bun:test";
import { createHandleRequest } from "../src/app";
import type { ServerDatabase } from "../src/db";
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

describe("inbox routes", () => {
	it("creates messages and lists only the requested workspace/user/run scope", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);

		await createInboxMessage(app, {
			workspaceId: "workspace-1",
			userId: "user-1",
			runId: "run-1",
			source: "agent_workflow_event",
			kind: "task_status_update",
			body: "Task moved to implementing",
			createdAt: "2026-05-15T10:00:00.000Z",
		});
		await createInboxMessage(app, {
			workspaceId: "workspace-1",
			userId: "user-1",
			runId: "run-1",
			source: "agent_workflow_event",
			kind: "agent_message",
			body: "Agent completed coding",
			createdAt: "2026-05-15T10:01:00.000Z",
			metadata: { stage: "reviewing" },
		});
		await createInboxMessage(app, {
			workspaceId: "workspace-1",
			userId: "user-2",
			runId: "run-1",
			source: "user_record",
			kind: "agent_message",
			body: "Different user scope",
			createdAt: "2026-05-15T10:02:00.000Z",
		});
		await createInboxMessage(app, {
			workspaceId: "workspace-2",
			userId: "user-1",
			runId: "run-1",
			source: "external_integration",
			kind: "agent_message",
			body: "Different workspace scope",
			createdAt: "2026-05-15T10:03:00.000Z",
		});

		const response = await app(
			new Request(
				"http://localhost/api/inbox/messages?workspaceId=workspace-1&userId=user-1&runId=run-1",
				{ method: "GET" },
			),
		);
		expect(response.status).toBe(200);
		const messages = (await response.json()) as Array<{
			workspaceId: string;
			userId: string;
			runId: string;
			body: string;
			createdAt: string;
			metadata: Record<string, unknown> | null;
		}>;
		expect(messages).toHaveLength(2);
		expect(messages.map((message) => message.body)).toEqual([
			"Agent completed coding",
			"Task moved to implementing",
		]);
		expect(messages[0]?.metadata).toEqual({ stage: "reviewing" });
		for (const message of messages) {
			expect(message.workspaceId).toBe("workspace-1");
			expect(message.userId).toBe("user-1");
			expect(message.runId).toBe("run-1");
		}
	});

	it("returns stable request and method errors", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);

		const missingScope = await app(
			new Request(
				"http://localhost/api/inbox/messages?workspaceId=workspace-1&runId=run-1",
				{ method: "GET" },
			),
		);
		expect(missingScope.status).toBe(400);
		expect((await missingScope.json()) as { error: string }).toEqual({
			error: "userId must be a non-empty string",
		});

		const invalidPayload = await app(
			new Request("http://localhost/api/inbox/messages", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					workspaceId: "workspace-1",
					userId: "user-1",
					runId: "run-1",
					source: "agent_workflow_event",
					kind: "agent_message",
					body: "Invalid metadata",
					metadata: ["not", "an", "object"],
				}),
			}),
		);
		expect(invalidPayload.status).toBe(400);
		expect((await invalidPayload.json()) as { error: string }).toEqual({
			error: "metadata must be an object or null",
		});

		const methodNotAllowed = await app(
			new Request("http://localhost/api/inbox/messages", {
				method: "PATCH",
			}),
		);
		expect(methodNotAllowed.status).toBe(405);
		expect((await methodNotAllowed.json()) as { error: string }).toEqual({
			error: "Method Not Allowed",
		});
	});
});

function createApp(db: ServerDatabase["db"]) {
	return createHandleRequest({
		cliExecutor: {
			execute: async (request) => ({ status: "succeeded", request }),
			executeStream: async (request) => ({
				status: "succeeded",
				request,
			}),
			getHistory: () => [],
		},
		db,
	});
}

async function createInboxMessage(
	app: ReturnType<typeof createApp>,
	payload: {
		workspaceId: string;
		userId: string;
		runId: string;
		source: string;
		kind: string;
		body: string;
		createdAt: string;
		metadata?: Record<string, unknown>;
	},
) {
	const response = await app(
		new Request("http://localhost/api/inbox/messages", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(payload),
		}),
	);
	expect(response.status).toBe(201);
}
