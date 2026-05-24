import { afterEach, describe, expect, it } from "bun:test";
import {
	boardTasksTable,
	inboxMessagesTable,
	taskExecutionLogsTable,
	taskExecutionStepsTable,
	taskPullRequestsTable,
	taskTagsTable,
	tokenUsageTable,
} from "devos-db";
import type { RealtimeEventPayload } from "../src/realtime";
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

describe("task routes", () => {
	it("supports task CRUD/list", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createTaskRouteTestApp(testDatabase.db);
		await seedTaskRouteProject(testDatabase.db, "project-1");

		const createResponse = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 1",
					content: "Body",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
					assigneeId: "owner-2",
				}),
			}),
		);
		expect(createResponse.status).toBe(201);
		const created = (await createResponse.json()) as {
			assigneeId: string | null;
			id: string;
			taskKey: string;
			title: string;
		};
		expect(created.title).toBe("Task 1");
		expect(created.taskKey).toBe("TASK(project-1)-1");
		expect(created.assigneeId).toBe("owner-2");

		const unassignedResponse = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: "Unassigned task",
					content: "Assign this later",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(unassignedResponse.status).toBe(201);
		const unassigned = (await unassignedResponse.json()) as {
			projectId: string | null;
			taskKey: string;
		};
		expect(unassigned.projectId).toBeNull();
		expect(unassigned.taskKey).toBe("TASK(owner-1)-1");

		const titleOnlyResponse = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					title: "Title only task",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(titleOnlyResponse.status).toBe(201);
		const titleOnly = (await titleOnlyResponse.json()) as {
			content: string;
		};
		expect(titleOnly.content).toBe("");

		const listResponse = await app(
			new Request("http://localhost/api/tasks", { method: "GET" }),
		);
		expect(listResponse.status).toBe(200);
		expect((await listResponse.json()) as unknown[]).toHaveLength(3);

		const readResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "GET",
			}),
		);
		expect(readResponse.status).toBe(200);
		expect(
			((await readResponse.json()) as { assigneeId: string | null }).assigneeId,
		).toBe("owner-2");

		const updateResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					status: "done",
					priority: 2,
					assigneeId: "owner-3",
				}),
			}),
		);
		expect(updateResponse.status).toBe(200);
		expect(await updateResponse.json()).toMatchObject({
			assigneeId: "owner-3",
			status: "done",
		});

		const clearAssigneeResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ assigneeId: null }),
			}),
		);
		expect(clearAssigneeResponse.status).toBe(200);
		expect(await clearAssigneeResponse.json()).toMatchObject({
			assigneeId: null,
		});

		const activityResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}/activity`, {
				method: "GET",
			}),
		);
		expect(activityResponse.status).toBe(200);
		expect(JSON.stringify(await activityResponse.json())).toContain(
			"changed assignee id",
		);

		const deleteResponse = await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "DELETE",
			}),
		);
		expect(deleteResponse.status).toBe(200);
	});

	it("returns consistent errors for invalid payloads, missing records, and FK failures", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createTaskRouteTestApp(testDatabase.db);
		await seedTaskRouteProject(testDatabase.db, "project-1");

		const invalid = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 1",
					content: "Body",
					priority: "high",
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(invalid.status).toBe(400);

		const fkFailure = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "missing-project",
					title: "Task 1",
					content: "Body",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		expect(fkFailure.status).toBe(400);
		expect((await fkFailure.json()) as { error: string }).toEqual({
			error: "Foreign key constraint failed",
		});

		const invalidDate = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 2",
					content: "Body",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
					dueDate: "not-a-date",
				}),
			}),
		);
		expect(invalidDate.status).toBe(400);

		const notFoundRead = await app(
			new Request("http://localhost/api/tasks/missing", { method: "GET" }),
		);
		expect(notFoundRead.status).toBe(404);

		const notFoundUpdate = await app(
			new Request("http://localhost/api/tasks/missing", {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status: "done" }),
			}),
		);
		expect(notFoundUpdate.status).toBe(404);

		const notFoundDelete = await app(
			new Request("http://localhost/api/tasks/missing", { method: "DELETE" }),
		);
		expect(notFoundDelete.status).toBe(404);
	});

	it("returns JSON not-found errors and deletes task-owned child records", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createTaskRouteTestApp(testDatabase.db);
		await seedTaskRouteProject(testDatabase.db, "project-1");

		const [task] = await testDatabase.db
			.insert(boardTasksTable)
			.values({
				id: "task-1",
				taskKey: "TASK-000001",
				projectId: "project-1",
				title: "Task 1",
				content: "Body",
				priority: 1,
				status: "open",
				creatorId: "owner-1",
				dueDate: null,
				linkedPr: null,
				createdAt: "2026-05-13T00:00:00.000Z",
				updatedAt: "2026-05-13T00:00:00.000Z",
			})
			.returning();
		await testDatabase.db.insert(taskTagsTable).values({
			id: "tag-1",
			taskId: task.id,
			tag: "bug",
		});
		await testDatabase.db.insert(taskPullRequestsTable).values({
			id: "pr-1",
			taskId: task.id,
			repository: "acme/project",
			prNumber: "42",
			prUrl: "https://github.com/acme/project/pull/42",
			createdAt: "2026-05-13T00:00:00.000Z",
		});
		await testDatabase.db.insert(inboxMessagesTable).values({
			id: "message-1",
			workspaceId: "workspace-1",
			userId: "user-1",
			runId: "run-1",
			source: "system",
			kind: "task",
			body: "Task message",
			taskId: task.id,
			agentId: null,
			metadata: null,
			createdAt: "2026-05-13T00:00:00.000Z",
		});
		await testDatabase.db.insert(taskExecutionLogsTable).values({
			id: "execution-1",
			taskId: task.id,
			status: "running",
			startedAt: "2026-05-13T00:00:00.000Z",
			finishedAt: null,
			log: "",
		});
		await testDatabase.db.insert(taskExecutionStepsTable).values({
			id: "step-1",
			executionLogId: "execution-1",
			stepNumber: 1,
			action: "plan",
			status: "completed",
			detail: null,
			recordedAt: "2026-05-13T00:01:00.000Z",
		});
		await testDatabase.db.insert(tokenUsageTable).values({
			id: "usage-1",
			runId: "run-1",
			taskId: task.id,
			taskExecutionLogId: "execution-1",
			stage: "planning",
			inputTokens: 1,
			outputTokens: 2,
			totalTokens: 3,
			recordedAt: "2026-05-13T00:02:00.000Z",
		});

		for (const method of ["GET", "PATCH", "DELETE"] as const) {
			const response = await app(
				new Request("http://localhost/api/tasks/", {
					method,
					headers: { "content-type": "application/json" },
					body:
						method === "PATCH"
							? JSON.stringify({ status: "done", priority: 2 })
							: undefined,
				}),
			);
			expect(response.status).toBe(404);
			expect((await response.json()) as { error: string }).toEqual({
				error: "Task not found",
			});
		}

		const deleteResponse = await app(
			new Request(`http://localhost/api/tasks/${task.id}`, {
				method: "DELETE",
			}),
		);
		expect(deleteResponse.status).toBe(200);
		expect(await testDatabase.db.select().from(boardTasksTable)).toEqual([]);
		expect(await testDatabase.db.select().from(taskTagsTable)).toEqual([]);
		expect(await testDatabase.db.select().from(taskPullRequestsTable)).toEqual(
			[],
		);
		expect(await testDatabase.db.select().from(inboxMessagesTable)).toEqual([]);
		expect(await testDatabase.db.select().from(taskExecutionLogsTable)).toEqual(
			[],
		);
		expect(
			await testDatabase.db.select().from(taskExecutionStepsTable),
		).toEqual([]);
		expect(await testDatabase.db.select().from(tokenUsageTable)).toEqual([]);
	});

	it("publishes realtime issue events only for successful mutations", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: RealtimeEventPayload[] = [];
		const app = createTaskRouteTestApp(testDatabase.db, {
			publish: (event) => events.push(event),
		});
		await seedTaskRouteProject(testDatabase.db, "project-1");

		const invalid = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ title: "Missing fields" }),
			}),
		);
		expect(invalid.status).toBe(400);
		expect(events).toEqual([]);

		const createResponse = await app(
			new Request("http://localhost/api/tasks", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					projectId: "project-1",
					title: "Task 1",
					content: "Body",
					priority: 1,
					status: "open",
					creatorId: "owner-1",
				}),
			}),
		);
		const created = (await createResponse.json()) as { id: string };

		await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "PATCH",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ status: "todo" }),
			}),
		);
		await app(
			new Request(`http://localhost/api/tasks/${created.id}`, {
				method: "DELETE",
			}),
		);

		expect(events.map((event) => event.type)).toEqual([
			"issue.created",
			"issue.updated",
			"issue.deleted",
		]);
		expect(events[0]).toMatchObject({
			type: "issue.created",
			issue: { id: created.id },
		});
		expect(events[1]).toMatchObject({
			type: "issue.updated",
			issue: { id: created.id, status: "todo" },
		});
	});

	it("does not expose the old daemon task-changed POST route", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createTaskRouteTestApp(testDatabase.db);

		const response = await app(
			new Request("http://localhost/api/internal/daemon/task-changed", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({ taskId: "task-1" }),
			}),
		);

		expect(response.status).toBe(404);
	});
});
