import { afterEach, describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import {
	boardTasksTable,
	pollingEventsTable,
	pollingStatusTable,
	taskCommentsTable,
	taskPullRequestsTable,
} from "devos-db";
import { WebSocket } from "ws";
import type { RealtimeEventPayload } from "../src/realtime";
import { WORKFLOW_DATA_WS_PATH } from "../src/workflow-data";
import {
	bindWorkflowDataClient,
	shouldHandleWorkflowDataUpgrade,
} from "../src/workflow-data/workflow-data-socket";
import type { WorkflowDataSocket } from "../src/workflow-data/workflow-data-socket.types";
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

describe("workflow data websocket", () => {
	it("serves task polling and mutation RPCs from server-owned DB state", async () => {
		const { socket, events, db } = await setupSocket();

		expect((await send(socket, "tasks.list")).payload).toEqual([
			expect.objectContaining({ id: "task-1", taskKey: "TASK-000001" }),
		]);
		expect(
			(await send(socket, "tasks.getByKey", { taskKey: "TASK-000001" }))
				.payload,
		).toEqual(expect.objectContaining({ id: "task-1" }));
		await send(socket, "tasks.update", {
			taskId: "task-1",
			values: { status: "implementing" },
		});
		await send(socket, "tasks.addComment", {
			taskId: "task-1",
			body: "Implementation started.",
		});
		await send(socket, "tasks.linkPullRequest", {
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
		const workflow = await send(socket, "tasks.createWorkflowTask", {
			projectId: "project-1",
			title: "Planned",
			content: "Ready",
			priority: 1,
			status: "todo",
			creatorId: "owner-1",
		});
		const intake = await send(socket, "tasks.createIntakeTask", {
			projectId: "project-1",
			title: "Inbox",
			description: "Needs planning",
		});
		await send(socket, "polling.record", {
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
			expect.objectContaining({ status: "todo" }),
		);
		expect(intake.payload).toEqual(
			expect.objectContaining({ status: "planning", creatorId: "owner-1" }),
		);
		expect(await db.select().from(pollingStatusTable)).toHaveLength(1);
		expect(await db.select().from(pollingEventsTable)).toHaveLength(1);
		expect(events.map((event) => event.type)).toContain("polling.event");
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

async function send(
	socket: FakeWorkflowDataSocket,
	action: string,
	payload?: unknown,
) {
	const requestId = crypto.randomUUID();
	socket.emitMessage(
		JSON.stringify({ type: "workflow.request", requestId, action, payload }),
	);
	return JSON.parse(await socket.nextSend()) as { payload: unknown };
}

function request(url: string): IncomingMessage {
	return { url } as IncomingMessage;
}

class FakeWorkflowDataSocket
	extends EventEmitter
	implements WorkflowDataSocket
{
	readyState: number = WebSocket.OPEN;
	readonly sent: string[] = [];
	private sendResolver: ((message: string) => void) | undefined;

	send(message: string): void {
		if (this.sendResolver) {
			this.sendResolver(message);
			this.sendResolver = undefined;
			return;
		}
		this.sent.push(message);
	}

	close(): void {
		this.readyState = WebSocket.CLOSED;
	}

	emitMessage(message: string): void {
		this.emit("message", message);
	}

	nextSend(): Promise<string> {
		const sent = this.sent.shift();
		if (sent) {
			return Promise.resolve(sent);
		}
		return new Promise((resolve) => {
			this.sendResolver = resolve;
		});
	}
}
