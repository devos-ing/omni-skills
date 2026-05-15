import { afterEach, describe, expect, it } from "bun:test";
import { createBoardRepository } from "../src/board";
import { boardTasksTable } from "../src/db";
import type { BoardTaskRow } from "../src/db/board-tasks.types";
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
			task: BoardTaskRow;
		};
		expect(body.status).toBe("created");
		expect(body.task.taskKey).toBe("TASK-000001");
		expect(body.task.title).toBe("Compose task creation");
		expect(body.task.content).toBe("Create both task records.");
		expect(body.task.status).toBe("planning");
		expect(body.task.linkedPr).toBeNull();
		const board = await createBoardRepository(
			testDatabase.db,
		).getWorkspaceProjectBoard("owner-1", "project-1");
		expect(
			board.statusColumns.find((column) => column.status === "planning")?.tasks,
		).toHaveLength(0);
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
						stdout: `${JSON.stringify(createdTaskChatIntake())}\n`,
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
			task: BoardTaskRow;
		};
		expect(body.status).toBe("created");
		expect(body.task).toEqual(createdTaskChatBoardTask({ projectId: null }));
		expect(body.task.projectId).toBeNull();
		expect(body.task.status).toBe("planning");
		expect(body.task.linkedPr).toBeNull();
		const tasks = await testDatabase.db.select().from(boardTasksTable);
		expect(tasks).toHaveLength(0);
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
