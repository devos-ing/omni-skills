import { afterEach, describe, expect, it } from "bun:test";
import {
	boardTasksTable,
	chatSessionsTable,
	taskExecutionLogsTable,
} from "devos-db";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";
import {
	createTaskRouteTestApp,
	seedTaskRouteProject,
} from "./task-route-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("chat session status route", () => {
	it("returns chat session status for idle, running, and archived sessions", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createTaskRouteTestApp(testDatabase.db);
		await seedTaskRouteProject(testDatabase.db, "project-1");
		await seedTask(testDatabase, "task-idle");
		await seedTask(testDatabase, "task-running");
		await seedTask(testDatabase, "task-archived");
		await seedSession(testDatabase, "session-idle", "task-idle", false);
		await seedSession(testDatabase, "session-running", "task-running", false);
		await seedSession(testDatabase, "session-archived", "task-archived", true);
		await seedExecution(
			testDatabase,
			"task-running",
			"old-success",
			"succeeded",
			1,
		);
		await seedExecution(
			testDatabase,
			"task-running",
			"current-run",
			"running",
			2,
		);

		const idleResponse = await app(statusRequest("session-idle"));
		const runningResponse = await app(statusRequest("session-running"));
		const archivedResponse = await app(statusRequest("session-archived"));
		const missingResponse = await app(statusRequest("missing-session"));
		const methodResponse = await app(statusRequest("session-idle", "POST"));

		expect(idleResponse.status).toBe(200);
		expect(await idleResponse.json()).toEqual({
			sessionId: "session-idle",
			taskId: "task-idle",
			status: "idle",
		});
		expect(runningResponse.status).toBe(200);
		expect(await runningResponse.json()).toEqual({
			sessionId: "session-running",
			taskId: "task-running",
			status: "running",
		});
		expect(archivedResponse.status).toBe(200);
		expect(await archivedResponse.json()).toEqual({
			sessionId: "session-archived",
			taskId: "task-archived",
			status: "archived",
		});
		expect(missingResponse.status).toBe(404);
		expect(methodResponse.status).toBe(405);
	});
});

function statusRequest(sessionId: string, method = "GET"): Request {
	return new Request(`http://localhost/api/chat/sessions/${sessionId}/status`, {
		method,
	});
}

async function seedTask(
	testDatabase: DrizzleServerTestDatabase,
	id: string,
): Promise<void> {
	await testDatabase.db.insert(boardTasksTable).values({
		id,
		taskKey: id.toUpperCase(),
		projectId: "project-1",
		title: id,
		content: "Body",
		priority: 1,
		status: "open",
		dueDate: null,
		creatorId: "owner-1",
		linkedPr: null,
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
	});
}

async function seedSession(
	testDatabase: DrizzleServerTestDatabase,
	id: string,
	taskId: string,
	archived: boolean,
): Promise<void> {
	await testDatabase.db.insert(chatSessionsTable).values({
		id,
		workspaceId: "workspace-1",
		projectId: "project-1",
		taskId,
		title: id,
		pendingRequest: null,
		pendingQuestions: null,
		archived,
		createdAt: "2026-06-01T00:00:00.000Z",
		updatedAt: "2026-06-01T00:00:00.000Z",
	});
}

async function seedExecution(
	testDatabase: DrizzleServerTestDatabase,
	taskId: string,
	id: string,
	status: string,
	minute: number,
): Promise<void> {
	await testDatabase.db.insert(taskExecutionLogsTable).values({
		id,
		taskId,
		status,
		startedAt: `2026-06-01T00:0${minute}:00.000Z`,
		finishedAt:
			status === "running" ? null : `2026-06-01T00:0${minute}:30.000Z`,
		log: "",
	});
}
