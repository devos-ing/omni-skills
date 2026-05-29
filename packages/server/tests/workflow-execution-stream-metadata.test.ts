import { afterEach, describe, expect, it } from "bun:test";
import { boardTasksTable } from "devos-db";
import type { RealtimeEventPayload } from "../src/realtime";
import { bindWorkflowDataClient } from "../src/workflow-data/workflow-data-socket";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";
import { seedTaskRouteProject } from "./task-route-test-helpers";
import {
	FakeWorkflowDataSocket,
	sendWorkflowDataRequest,
} from "./workflow-socket-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	await testDatabase?.cleanup();
	testDatabase = undefined;
});

describe("workflow execution stream metadata", () => {
	it("publishes agent log events with project, task, model, and phrase markers", async () => {
		const { socket, events } = await setupSocket();
		await sendWorkflowDataRequest(socket, "taskExecutions.start", {
			executionLogId: "exec-1",
			taskId: "task-1",
			projectId: "project-1",
			issueKey: "TASK-000001",
			startedAt: "2026-05-29T00:00:00.000Z",
		});
		await sendWorkflowDataRequest(socket, "taskExecutions.appendStream", {
			executionLogId: "exec-1",
			eventId: "stream-1",
			projectId: "project-1",
			taskId: "task-1",
			issueKey: "TASK-000001",
			stage: "implementing",
			stream: "stdout",
			text: "agent stream line\n",
			agentRole: "implementing",
			agentBackend: "codex",
			agentModel: "gpt-5",
			phrase: "implementing",
			emittedAt: "2026-05-29T00:00:01.000Z",
		});

		expect(events).toContainEqual(
			expect.objectContaining({
				type: "task.execution.event",
				execution: expect.objectContaining({
					taskId: "task-1",
					event: expect.objectContaining({
						kind: "log",
						projectId: "project-1",
						taskId: "task-1",
						issueKey: "TASK-000001",
						agentRole: "implementing",
						agentBackend: "codex",
						agentModel: "gpt-5",
						phrase: "implementing",
					}),
				}),
			}),
		);
	});
});

async function setupSocket() {
	testDatabase = await createDrizzleServerTestDatabase();
	await seedTaskRouteProject(testDatabase.db, "project-1");
	await testDatabase.db.insert(boardTasksTable).values({
		id: "task-1",
		taskKey: "TASK-000001",
		projectId: "project-1",
		title: "Task",
		content: "Body",
		priority: 1,
		status: "plan",
		creatorId: "owner-1",
		dueDate: null,
		linkedPr: null,
		createdAt: "2026-05-29T00:00:00.000Z",
		updatedAt: "2026-05-29T00:00:00.000Z",
	});
	const events: RealtimeEventPayload[] = [];
	const socket = new FakeWorkflowDataSocket();
	bindWorkflowDataClient(socket, {
		db: testDatabase.db,
		realtimeEvents: { publish: (event) => events.push(event) },
	});
	return { socket, events };
}
