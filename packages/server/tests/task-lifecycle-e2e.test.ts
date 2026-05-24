import { afterEach, describe, expect, it } from "bun:test";
import { createHandleRequest } from "../src/app";
import { createRealtimeEventBus } from "../src/realtime";
import type { RealtimeEvent } from "../src/realtime";
import { createWorkflowDataService } from "../src/workflow-data/workflow-data-service";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";
import { seedTaskRouteProject } from "./task-route-test-helpers";

interface TestServer {
	handler: ReturnType<typeof createHandleRequest>;
	workflowDataService: ReturnType<typeof createWorkflowDataService>;
	database: DrizzleServerTestDatabase;
	events: RealtimeEvent[];
}

let testServer: TestServer | undefined;

afterEach(async () => {
	if (!testServer) {
		return;
	}
	await testServer.database.cleanup();
	testServer = undefined;
});

describe("task lifecycle e2e", () => {
	it("creates a task, records polling, assigns an agent, and updates status", async () => {
		testServer = await setupTestServer();
		const created = await requestJson<{
			assigneeId: string | null;
			id: string;
			projectId: string;
			status: string;
			taskKey: string;
		}>(testServer.handler, "/api/tasks", {
			method: "POST",
			body: {
				projectId: "project-1",
				title: "Lifecycle task",
				content: "Exercise the board task lifecycle.",
				priority: 1,
				status: "todo",
				creatorId: "owner-1",
			},
		});

		expect(created.taskKey).toBe("TASK(project-1)-1");
		expect(created.projectId).toBe("project-1");
		expect(created.status).toBe("todo");
		expect(created.assigneeId).toBeNull();

		const polling = await testServer.workflowDataService.handle(
			"polling.record",
			{
				pollerId: "internal-tasks:project-1",
				sourceType: "internal-tasks",
				sourceId: "project-1",
				projectId: "project-1",
				state: "success",
				intervalMs: 5000,
				level: "info",
				eventType: "tick_completed",
				message: "Internal task polling tick completed",
				counts: { readyTaskCount: 1, dispatchCount: 1 },
			},
		);
		expect(polling).toEqual({ recorded: true });

		const assigned = await requestJson<{ assigneeId: string }>(
			testServer.handler,
			`/api/tasks/${created.id}`,
			{
				method: "PATCH",
				body: { assigneeId: "agent-codex-1" },
			},
		);
		expect(assigned.assigneeId).toBe("agent-codex-1");

		const updated = (await testServer.workflowDataService.handle(
			"tasks.update",
			{
				taskId: created.id,
				values: { status: "implementing" },
			},
		)) as { id: string; status: string };
		expect(updated).toMatchObject({
			id: created.id,
			status: "implementing",
		});

		const finalTask = await requestJson<{
			assigneeId: string;
			status: string;
		}>(testServer.handler, `/api/tasks/${created.id}`);
		expect(finalTask).toMatchObject({
			assigneeId: "agent-codex-1",
			status: "implementing",
		});

		const taskList = await requestJson<Array<{ id: string; status: string }>>(
			testServer.handler,
			"/api/tasks",
		);
		expect(taskList).toEqual([
			expect.objectContaining({
				id: created.id,
				assigneeId: "agent-codex-1",
				status: "implementing",
			}),
		]);

		const activity = await requestJson<unknown>(
			testServer.handler,
			`/api/tasks/${created.id}/activity`,
		);
		expect(JSON.stringify(activity)).toContain("changed assignee id");
		expect(JSON.stringify(activity)).toContain("changed status");

		const pollingStatus = await requestJson<{
			events: Array<{ eventType: string; message: string }>;
			pollers: Array<{ id: string; lastReadyTaskCount: number }>;
		}>(testServer.handler, "/api/polling/status");
		expect(pollingStatus.pollers).toContainEqual(
			expect.objectContaining({
				id: "internal-tasks:project-1",
				lastReadyTaskCount: 1,
			}),
		);
		expect(pollingStatus.events).toContainEqual(
			expect.objectContaining({
				eventType: "tick_completed",
				message: "Internal task polling tick completed",
			}),
		);

		expect(testServer.events.map((event) => event.type)).toEqual([
			"issue.created",
			"polling.event",
			"issue.updated",
			"issue.updated",
		]);
	});
});

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
	const workflowDataService = createWorkflowDataService(
		database.db,
		realtimeEvents,
	);
	return {
		handler,
		workflowDataService,
		database,
		events,
	};
}

async function requestJson<T>(
	handler: ReturnType<typeof createHandleRequest>,
	pathname: string,
	init?: {
		method?: string;
		body?: unknown;
	},
): Promise<T> {
	const response = await handler(
		new Request(`http://localhost${pathname}`, {
			method: init?.method ?? "GET",
			headers: init?.body
				? {
						"content-type": "application/json",
					}
				: undefined,
			body: init?.body ? JSON.stringify(init.body) : undefined,
		}),
	);
	expect(response.ok).toBe(true);
	return (await response.json()) as T;
}
