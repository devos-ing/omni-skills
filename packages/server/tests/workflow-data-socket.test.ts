import { afterEach, describe, expect, it } from "bun:test";
import {
	boardTasksTable,
	pollingEventsTable,
	pollingStatusTable,
	taskCommentsTable,
	taskExecutionLogsTable,
	taskExecutionStepsTable,
	taskPullRequestsTable,
} from "devos-db";
import type { RealtimeEventPayload } from "../src/realtime";
import { WORKFLOW_DATA_WS_PATH } from "../src/workflow-data";
import {
	bindWorkflowDataClient,
	shouldHandleWorkflowDataUpgrade,
} from "../src/workflow-data/workflow-data-socket";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";
import { seedTaskRouteProject } from "./task-route-test-helpers";
import {
	FakeWorkflowDataSocket,
	request,
	sendWorkflowDataRequest,
} from "./workflow-socket-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("workflow data websocket", () => {
	it("serves task polling and mutation RPCs from server-owned DB state", async () => {
		const { socket, events, db } = await setupSocket();

		expect(
			(await sendWorkflowDataRequest(socket, "tasks.list")).payload,
		).toEqual([
			expect.objectContaining({ id: "task-1", taskKey: "TASK-000001" }),
		]);
		expect(
			(
				await sendWorkflowDataRequest(socket, "tasks.getByKey", {
					taskKey: "TASK-000001",
				})
			).payload,
		).toEqual(expect.objectContaining({ id: "task-1" }));
		await sendWorkflowDataRequest(socket, "tasks.update", {
			taskId: "task-1",
			values: { status: "implementing" },
		});
		await sendWorkflowDataRequest(socket, "tasks.addComment", {
			taskId: "task-1",
			body: "Implementation started.",
		});
		await sendWorkflowDataRequest(socket, "tasks.linkPullRequest", {
			taskId: "task-1",
			repository: "acme/repo",
			pullRequest: {
				number: 12,
				url: "https://github.com/acme/repo/pull/12",
				branch: "codex/task-000001",
				title: "Task PR",
			},
		});

		expect(await db.select().from(taskCommentsTable)).toHaveLength(3);
		expect(await db.select().from(taskPullRequestsTable)).toEqual([
			expect.objectContaining({ taskId: "task-1", prNumber: "12" }),
		]);
		expect(events.map((event) => event.type)).toEqual([
			"issue.updated",
			"issue.updated",
			"issue.updated",
		]);
	});

	it("creates workflow/intake tasks and records polling through the server", async () => {
		const { socket, events, db } = await setupSocket();
		const workflow = await sendWorkflowDataRequest(
			socket,
			"tasks.createWorkflowTask",
			{
				projectId: "project-1",
				title: "Planned",
				content: "Ready",
				priority: 1,
				status: "todo",
				creatorId: "owner-1",
			},
		);
		const intake = await sendWorkflowDataRequest(
			socket,
			"tasks.createIntakeTask",
			{
				projectId: "project-1",
				title: "Inbox",
				description: "Needs planning",
			},
		);
		await sendWorkflowDataRequest(socket, "polling.record", {
			pollerId: "linear:project-1",
			sourceType: "linear",
			sourceId: "project-1",
			projectId: "project-1",
			state: "success",
			intervalMs: 30000,
			level: "info",
			eventType: "cycle_completed",
			message: "done",
		});

		expect(workflow.payload).toEqual(
			expect.objectContaining({
				taskKey: "TASK(project-1)-1",
				status: "todo",
			}),
		);
		expect(intake.payload).toEqual(
			expect.objectContaining({
				taskKey: "TASK(project-1)-2",
				status: "planning",
				creatorId: "owner-1",
			}),
		);
		expect(await db.select().from(pollingStatusTable)).toHaveLength(1);
		expect(await db.select().from(pollingEventsTable)).toHaveLength(1);
		expect(events.map((event) => event.type)).toContain("polling.event");
	});

	it("records task execution logs, streams, and progress idempotently", async () => {
		const { socket, events, db } = await setupSocket();
		await sendWorkflowDataRequest(socket, "taskExecutions.start", {
			executionLogId: "exec-1",
			taskId: "task-1",
			startedAt: "2026-05-13T00:01:00.000Z",
		});
		await sendWorkflowDataRequest(socket, "taskExecutions.appendStream", {
			executionLogId: "exec-1",
			eventId: "stream-1",
			stream: "stdout",
			text: "Implemented the thing\n",
			emittedAt: "2026-05-13T00:01:01.000Z",
		});
		await sendWorkflowDataRequest(socket, "taskExecutions.appendStream", {
			executionLogId: "exec-1",
			eventId: "stream-1",
			stream: "stdout",
			text: "Implemented the thing\n",
			emittedAt: "2026-05-13T00:01:01.000Z",
		});
		await sendWorkflowDataRequest(socket, "taskExecutions.recordProgress", {
			executionLogId: "exec-1",
			eventId: "step-1",
			stepNumber: 1,
			event: {
				schema: "devos.workflow.stream.v1",
				emittedAt: "2026-05-13T00:01:02.000Z",
				kind: "action",
				projectId: "project-1",
				issueKey: "TASK-000001",
				stage: "implementing",
				action: "implementation",
				status: "succeeded",
			},
		});
		await sendWorkflowDataRequest(socket, "taskExecutions.recordProgress", {
			executionLogId: "exec-1",
			eventId: "step-1",
			stepNumber: 1,
			event: {
				schema: "devos.workflow.stream.v1",
				emittedAt: "2026-05-13T00:01:02.000Z",
				kind: "action",
				action: "implementation",
				status: "succeeded",
			},
		});
		await sendWorkflowDataRequest(socket, "taskExecutions.finish", {
			executionLogId: "exec-1",
			status: "succeeded",
			finishedAt: "2026-05-13T00:01:03.000Z",
		});

		const [log] = await db.select().from(taskExecutionLogsTable);
		expect(log).toMatchObject({
			id: "exec-1",
			taskId: "task-1",
			status: "succeeded",
		});
		expect(log?.finishedAt).toContain("2026-05-13");
		expect(log?.log.match(/Implemented the thing/g)).toHaveLength(1);
		expect(await db.select().from(taskExecutionStepsTable)).toHaveLength(1);
		expect(events.map((event) => event.type)).toContain("task.execution.event");
	});

	it("starts execution logs by project and task key when task id is stale", async () => {
		const { socket, db } = await setupSocket();

		await sendWorkflowDataRequest(socket, "taskExecutions.start", {
			executionLogId: "exec-stale-task-id",
			taskId: "stale-task-id",
			projectId: "project-1",
			issueKey: "TASK-000001",
			startedAt: "2026-05-13T00:01:00.000Z",
		});

		const logs = await db.select().from(taskExecutionLogsTable);
		expect(logs).toEqual([
			expect.objectContaining({
				id: "exec-stale-task-id",
				taskId: "task-1",
				status: "running",
			}),
		]);
	});

	it("rejects malformed frames and matches only the workflow path", async () => {
		const { socket } = await setupSocket();

		socket.emitMessage("{nope");
		expect(JSON.parse(await socket.nextSend())).toMatchObject({
			type: "workflow.response",
			status: "error",
			code: "invalid_json",
		});
		expect(
			shouldHandleWorkflowDataUpgrade(
				request("/api/workflow"),
				WORKFLOW_DATA_WS_PATH,
			),
		).toBe(true);
		expect(
			shouldHandleWorkflowDataUpgrade(
				request("/api/events"),
				WORKFLOW_DATA_WS_PATH,
			),
		).toBe(false);
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
		status: "todo",
		creatorId: "owner-1",
		dueDate: null,
		linkedPr: null,
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
	const events: RealtimeEventPayload[] = [];
	const socket = new FakeWorkflowDataSocket();
	bindWorkflowDataClient(socket, {
		db: testDatabase.db,
		realtimeEvents: { publish: (event) => events.push(event) },
	});
	return { socket, events, db: testDatabase.db };
}
