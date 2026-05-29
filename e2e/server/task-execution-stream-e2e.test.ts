import { afterEach, describe, expect, it } from "bun:test";
import { createHandleRequest } from "../../packages/server/src/app";
import { createRealtimeEventBus } from "../../packages/server/src/realtime";
import type { RealtimeEvent } from "../../packages/server/src/realtime";
import { createWorkflowDataService } from "../../packages/server/src/workflow-data/workflow-data-service";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "../../packages/server/tests/server-db-test-helpers";
import { seedTaskRouteProject } from "../../packages/server/tests/task-route-test-helpers";

let testServer: TestServer | undefined;

afterEach(async () => {
	await testServer?.database.cleanup();
	testServer = undefined;
});

describe("task execution stream e2e", () => {
	it("streams agent execution logs with task and model metadata", async () => {
		testServer = await setupTestServer();
		const created = await requestJson<{ id: string; taskKey: string }>(
			testServer.handler,
			"/api/tasks",
			{
				method: "POST",
				body: {
					projectId: "project-1",
					title: "Stream task",
					content: "Stream agent logs.",
					priority: 1,
					status: "plan",
					creatorId: "owner-1",
				},
			},
		);

		await testServer.workflowDataService.handle("taskExecutions.start", {
			executionLogId: "exec-stream-1",
			taskId: created.id,
			projectId: "project-1",
			issueKey: created.taskKey,
			startedAt: "2026-05-29T00:00:00.000Z",
		});
		await testServer.workflowDataService.handle("taskExecutions.appendStream", {
			executionLogId: "exec-stream-1",
			eventId: "stream-1",
			projectId: "project-1",
			taskId: created.id,
			issueKey: created.taskKey,
			stage: "implementing",
			stream: "stdout",
			text: "agent stream line\n",
			agentRole: "implementing",
			agentBackend: "codex",
			agentModel: "gpt-5.4",
			phrase: "implementing",
			emittedAt: "2026-05-29T00:00:01.000Z",
		});

		expect(testServer.events).toContainEqual(
			expect.objectContaining({
				type: "task.execution.event",
				execution: expect.objectContaining({
					taskId: created.id,
					event: expect.objectContaining({
						kind: "log",
						projectId: "project-1",
						taskId: created.id,
						issueKey: created.taskKey,
						agentRole: "implementing",
						agentBackend: "codex",
						agentModel: "gpt-5.4",
						phrase: "implementing",
					}),
				}),
			}),
		);
	});
});

interface TestServer {
	handler: ReturnType<typeof createHandleRequest>;
	workflowDataService: ReturnType<typeof createWorkflowDataService>;
	database: DrizzleServerTestDatabase;
	events: RealtimeEvent[];
}

async function setupTestServer(): Promise<TestServer> {
	const database = await createDrizzleServerTestDatabase();
	await seedTaskRouteProject(database.db, "project-1");
	const realtimeEvents = createRealtimeEventBus();
	const events: RealtimeEvent[] = [];
	realtimeEvents.subscribe((event) => events.push(event));
	const handler = createHandleRequest({
		cliExecutor: {
			execute: async (request) => ({ status: "succeeded", request }),
			executeStream: async (request) => ({ status: "succeeded", request }),
			getHistory: () => [],
		},
		db: database.db,
		realtimeEvents,
	});
	return {
		handler,
		workflowDataService: createWorkflowDataService(database.db, realtimeEvents),
		database,
		events,
	};
}

async function requestJson<T>(
	handler: ReturnType<typeof createHandleRequest>,
	pathname: string,
	init: { method: string; body: unknown },
): Promise<T> {
	const response = await handler(
		new Request(`http://localhost${pathname}`, {
			method: init.method,
			headers: { "content-type": "application/json" },
			body: JSON.stringify(init.body),
		}),
	);
	expect(response.ok).toBe(true);
	return (await response.json()) as T;
}
