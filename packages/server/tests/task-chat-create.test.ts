import { afterEach, describe, expect, it } from "bun:test";
import { type BoardTaskRow, boardTasksTable } from "devos-db";
import { createBoardRepository } from "../src/board";
import {
	type DrizzleServerTestDatabase,
	createDrizzleServerTestDatabase,
} from "./server-db-test-helpers";
import {
	createTaskChatCreateTestApp,
	createdTaskChatBoardTask,
	createdTaskChatIntake,
	seedTaskChatProject,
} from "./task-chat-create-test-helpers";

let testDatabase: DrizzleServerTestDatabase | undefined;

type BoardTaskApiRow = BoardTaskRow & { assigneeId: string | null };

afterEach(async () => {
	if (testDatabase) {
		await testDatabase.cleanup();
		testDatabase = undefined;
	}
});

describe("chat task create route", () => {
	it("returns a board task from structured task intake output", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		await seedTaskChatProject(testDatabase.db, "project-1");
		const calls: unknown[] = [];
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => {
				calls.push(request);
				return {
					status: "succeeded",
					request,
					commandResult: {
						code: 0,
						stdout: `${JSON.stringify(
							createdTaskChatIntake({ projectId: null }),
						)}\n`,
						stderr: "",
					},
				};
			},
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create the composed flow",
					projectId: "project-1",
					answers: [{ question: "Where?", answer: "Web" }],
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			status: string;
			task: BoardTaskApiRow;
		};
		expect(body.status).toBe("created");
		expect(body.task.taskKey).toBe("TASK(project-1)-1");
		expect(body.task.title).toBe("Compose task creation");
		expect(body.task.content).toBe("Create both task records.");
		expect(body.task.status).toBe("planning");
		expect(body.task.linkedPr).toBeNull();
		expect(body.task.projectId).toBe("project-1");
		expect(body.task.assigneeId).toBeNull();
		const tasks = await testDatabase.db.select().from(boardTasksTable);
		expect(tasks).toEqual([withoutAssigneeId(body.task)]);
		const board = await createBoardRepository(
			testDatabase.db,
		).getWorkspaceProjectBoard("owner-1", "project-1");
		expect(board).not.toBeNull();
		expect(
			board?.statusColumns.find((column) => column.status === "planning")
				?.tasks,
		).toHaveLength(1);
		expect(calls).toEqual([
			{
				action: "task",
				taskAction: "create",
				request: "Create the composed flow",
				projectId: "project-1",
				nonInteractive: true,
				clarificationAnswers: [{ question: "Where?", answer: "Web" }],
				json: true,
			},
		]);
	});

	it("returns needs_info from task intake without creating a board task", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		await seedTaskChatProject(testDatabase.db, "project-1");
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => ({
				status: "succeeded",
				request,
				commandResult: {
					code: 0,
					stdout: '{"status":"needs_info","questions":["Which project?"]}\n',
					stderr: "",
				},
			}),
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create something",
					projectId: "project-1",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "needs_info",
			questions: ["Which project?"],
		});
		const tasks = await testDatabase.db.select().from(boardTasksTable);
		expect(tasks).toHaveLength(0);
	});

	it("creates an unassigned board task when project id is omitted", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const calls: unknown[] = [];
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => {
				calls.push(request);
				return {
					status: "succeeded",
					request,
					commandResult: {
						code: 0,
						stdout: `${JSON.stringify(
							createdTaskChatIntake({
								projectId: null,
								taskKey: "TASK(owner-1)-1",
							}),
						)}\n`,
						stderr: "",
					},
				};
			},
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create something unassigned",
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			status: string;
			task: BoardTaskApiRow;
		};
		expect(body.status).toBe("created");
		expect(body.task.projectId).toBeNull();
		expect(body.task.taskKey).toBe("TASK(owner-1)-1");
		expect(body.task.status).toBe("planning");
		expect(body.task.linkedPr).toBeNull();
		expect(body.task.assigneeId).toBeNull();
		const tasks = await testDatabase.db.select().from(boardTasksTable);
		expect(tasks).toEqual([withoutAssigneeId(body.task)]);
		expect(calls).toEqual([
			{
				action: "task",
				taskAction: "create",
				request: "Create something unassigned",
				projectId: undefined,
				nonInteractive: true,
				clarificationAnswers: undefined,
				json: true,
			},
		]);
	});

	it("normalizes legacy task description output to board task content", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const legacyTask = {
			...createdTaskChatBoardTask({ content: undefined, projectId: null }),
			description: "Legacy task body.",
		};
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => ({
				status: "succeeded",
				request,
				commandResult: {
					code: 0,
					stdout: `${JSON.stringify({
						status: "created",
						task: legacyTask,
					})}\n`,
					stderr: "",
				},
			}),
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create something legacy shaped",
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			status: string;
			task: BoardTaskApiRow;
		};
		expect(body.status).toBe("created");
		expect(body.task.content).toBe("Legacy task body.");
		expect(body.task.projectId).toBeNull();
		expect(body.task.assigneeId).toBeNull();
		const tasks = await testDatabase.db.select().from(boardTasksTable);
		expect(tasks).toEqual([withoutAssigneeId(body.task)]);
	});

	it("does not duplicate a task when chat intake already inserted it", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		await seedTaskChatProject(testDatabase.db, "project-1");
		const existingTask = createdTaskChatBoardTask({
			id: "existing-task",
			projectId: "project-1",
		});
		await testDatabase.db.insert(boardTasksTable).values(existingTask);
		const [persistedExistingTask] = await testDatabase.db
			.select()
			.from(boardTasksTable);
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => ({
				status: "succeeded",
				request,
				commandResult: {
					code: 0,
					stdout: `${JSON.stringify({
						status: "created",
						task: existingTask,
					})}\n`,
					stderr: "",
				},
			}),
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create something already persisted",
					projectId: "project-1",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "created",
			task: { ...persistedExistingTask, assigneeId: null },
		});
		const tasks = await testDatabase.db.select().from(boardTasksTable);
		expect(tasks).toEqual([persistedExistingTask]);
	});

	it("returns db_error for stale Linear-shaped task errors", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => ({
				status: "succeeded",
				request,
				commandResult: {
					code: 0,
					stdout: '{"status":"linear_error","error":"legacy parser failed"}\n',
					stderr: "",
				},
			}),
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create something stale",
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as { status: string; error: string };
		expect(body.status).toBe("db_error");
		expect(body.error).toContain("legacy Linear error output");
		expect(body.error).not.toContain("invalid_union");
	});

	it("returns db_error when CLI task creation fails", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => ({
				status: "failed",
				request,
				error: "Project not found",
			}),
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create something",
					projectId: "missing-project",
				}),
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as { status: string; error: string };
		expect(body.status).toBe("db_error");
		expect(body.error).toBe("Project not found");
	});

	it("returns db_error when task intake fails", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		await seedTaskChatProject(testDatabase.db, "project-1");
		const app = createTaskChatCreateTestApp(
			testDatabase.db,
			async (request) => ({
				status: "failed",
				request,
				error: "Task creation failed",
			}),
		);

		const response = await app(
			new Request("http://localhost/api/tasks/chat-create", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					request: "Create something",
					projectId: "project-1",
				}),
			}),
		);

		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			status: "db_error",
			error: "Task creation failed",
		});
	});
});

function withoutAssigneeId(task: BoardTaskApiRow): BoardTaskRow {
	const { assigneeId: _assigneeId, ...row } = task;
	return row;
}
