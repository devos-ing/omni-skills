import { afterEach, describe, expect, it } from "bun:test";
import {
	type ServerDatabase,
	boardProjectsTable,
	boardTasksTable,
	projectBoardsTable,
	taskCommentsTable,
	taskExecutionLogsTable,
	taskExecutionStepsTable,
} from "devos-db";
import { createServerTestApp } from "./app-test-helpers";
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

describe("task activity routes", () => {
	it("returns activity and records task update events", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createApp(testDatabase.db);
		await seedProject(testDatabase.db);
		await seedActivityTask(testDatabase.db);
		await seedActivityRows(testDatabase.db);

		const response = await app(
			new Request("http://localhost/api/tasks/task-activity-1/activity"),
		);
		expect(response.status).toBe(200);
		const activity = (await response.json()) as {
			activities: Array<{ kind: string; body: string; steps?: unknown[] }>;
		};
		expect(activity.activities.map((item) => item.kind)).toEqual([
			"created",
			"comment",
			"execution",
		]);
		expect(activity.activities[1]?.body).toContain("Edit `page.tsx`");
		expect(activity.activities[2]?.steps).toHaveLength(1);

		const updateResponse = await app(
			new Request("http://localhost/api/tasks/task-activity-1", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status: "implementing", title: "Next title" }),
			}),
		);
		expect(updateResponse.status).toBe(200);

		const updatedResponse = await app(
			new Request("http://localhost/api/tasks/task-activity-1/activity"),
		);
		const updated = (await updatedResponse.json()) as {
			activities: Array<{ actorType: string; body: string }>;
		};
		expect(updated.activities.at(-1)).toMatchObject({
			actorType: "system",
			body: expect.stringContaining("changed title"),
		});

		const missing = await app(
			new Request("http://localhost/api/tasks/missing/activity"),
		);
		expect(missing.status).toBe(404);
	});
});

function createApp(db: ServerDatabase["db"]) {
	return createServerTestApp(db);
}

async function seedProject(db: ServerDatabase["db"]): Promise<void> {
	await db.insert(projectBoardsTable).values({
		id: "board-1",
		name: "Board",
		description: "Test board",
		ownerId: "owner-1",
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
	await db.insert(boardProjectsTable).values({
		id: "project-1",
		boardId: "board-1",
		externalProjectId: null,
		name: "Project",
		description: null,
		ownerId: "owner-1",
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
}

async function seedActivityTask(db: ServerDatabase["db"]): Promise<void> {
	await db.insert(boardTasksTable).values({
		id: "task-activity-1",
		taskKey: "TASK-000777",
		projectId: "project-1",
		title: "Activity task",
		content: "Body",
		priority: 1,
		status: "planning",
		creatorId: "owner-1",
		dueDate: null,
		linkedPr: null,
		createdAt: "2026-05-13T00:00:00.000Z",
		updatedAt: "2026-05-13T00:00:00.000Z",
	});
}

async function seedActivityRows(db: ServerDatabase["db"]): Promise<void> {
	await db.insert(taskCommentsTable).values({
		id: "comment-1",
		taskId: "task-activity-1",
		authorId: "piv-planner",
		authorType: "agent",
		comment: "# Plan\n- Edit `page.tsx`",
		createdAt: "2026-05-13T00:01:00.000Z",
	});
	await db.insert(taskExecutionLogsTable).values({
		id: "exec-1",
		taskId: "task-activity-1",
		status: "success",
		startedAt: "2026-05-13T00:02:00.000Z",
		finishedAt: "2026-05-13T00:03:00.000Z",
		log: "Implemented and tested",
	});
	await db.insert(taskExecutionStepsTable).values({
		id: "step-1",
		executionLogId: "exec-1",
		stepNumber: 1,
		action: "run tests",
		status: "success",
		detail: "bun test passed",
		recordedAt: "2026-05-13T00:02:30.000Z",
	});
}
