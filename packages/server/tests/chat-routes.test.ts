import { afterEach, describe, expect, it } from "bun:test";
import {
	boardProjectsTable,
	boardTasksTable,
	chatMessagesTable,
	chatSessionsTable,
	eq,
} from "devos-db";
import { createJsonRequest, createServerTestApp } from "./app-test-helpers";
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

describe("chat routes", () => {
	it("exposes and uses the configured local workspace", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const workspace = { id: "workspace-abcdef1234567890", name: "Roy Lab" };
		await testDatabase.db.insert(chatSessionsTable).values({
			id: "legacy-session",
			workspaceId: "owner-1",
			projectId: null,
			taskId: null,
			title: "Legacy",
			pendingRequest: null,
			pendingQuestions: null,
			createdAt: "2026-05-13T00:00:00.000Z",
			updatedAt: "2026-05-13T00:00:00.000Z",
		});
		const app = createServerTestApp(testDatabase.db, {
			workspace,
			workspacePath: testDatabase.path,
		});

		const current = await app(
			new Request("http://localhost/api/workspace/current"),
		);
		const created = await app(
			createJsonRequest("POST", "/api/chat/sessions", {}),
		);

		expect(await current.json()).toEqual({
			workspaceId: workspace.id,
			name: workspace.name,
		});
		expect((await created.json()) as { workspaceId: string }).toMatchObject({
			workspaceId: workspace.id,
		});
		const [legacy] = await testDatabase.db
			.select()
			.from(chatSessionsTable)
			.where(eq(chatSessionsTable.id, "legacy-session"));
		const [project] = await testDatabase.db
			.select()
			.from(boardProjectsTable)
			.where(eq(boardProjectsTable.id, "default"));
		const [task] = await testDatabase.db.select().from(boardTasksTable);
		expect(legacy?.workspaceId).toBe(workspace.id);
		expect(project?.ownerId).toBe(workspace.id);
		expect(task?.creatorId).toBe(workspace.id);
	});

	it("creates a default project issue for new chat sessions", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const events: unknown[] = [];
		const app = createServerTestApp(testDatabase.db, {
			realtimeEvents: { publish: (event) => events.push(event) },
			workspacePath: testDatabase.path,
		});

		const response = await app(
			createJsonRequest("POST", "/api/chat/sessions", {}),
		);

		expect(response.status).toBe(201);
		const body = (await response.json()) as {
			id: string;
			projectId: string;
			taskId: string;
			title: string;
		};
		expect(body.projectId).toBe("default");
		expect(body.taskId).toBeTruthy();
		expect(body.title).toBe("Untitled");

		const [project] = await testDatabase.db
			.select()
			.from(boardProjectsTable)
			.where(eq(boardProjectsTable.id, "default"));
		const [task] = await testDatabase.db
			.select()
			.from(boardTasksTable)
			.where(eq(boardTasksTable.id, body.taskId));

		expect(project?.name).toBe("Default Project");
		expect(task).toMatchObject({
			id: body.taskId,
			projectId: "default",
			title: "Untitled chat",
			content: "",
			priority: 0,
			status: "planning",
			creatorId: "owner-1",
		});
		expect(events.map((event) => (event as { type: string }).type)).toEqual([
			"project.created",
			"issue.created",
			"chat.session.created",
		]);
		expect(events[0]).toMatchObject({
			type: "project.created",
			project: { id: "default" },
		});
		expect(events[1]).toMatchObject({ type: "issue.created", issue: task });
		expect(events[2]).toMatchObject({
			type: "chat.session.created",
			session: { id: body.id },
		});
	});

	it("updates the session issue from the first chat message without task intake", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const cliCalls: unknown[] = [];
		const events: unknown[] = [];
		const app = createServerTestApp(testDatabase.db, {
			cliExecutor: {
				execute: async (request) => {
					cliCalls.push(request);
					return { status: "succeeded", request };
				},
				executeStream: async (request) => {
					cliCalls.push(request);
					return { status: "succeeded", request };
				},
				getHistory: () => [],
			},
			realtimeEvents: { publish: (event) => events.push(event) },
			workspacePath: testDatabase.path,
		});
		const created = await app(
			createJsonRequest("POST", "/api/chat/sessions", {}),
		);
		const session = (await created.json()) as { id: string; taskId: string };

		const response = await app(
			createJsonRequest("POST", `/api/chat/sessions/${session.id}/send`, {
				content: "Build the dashboard",
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			issue: { content: string; id: string; title: string };
			messages: Array<{ content: string; taskId: string | null }>;
			session: { taskId: string | null; title: string };
		};
		expect(body.session.title).toBe("Build the dashboard");
		expect(body.session.taskId).toBe(session.taskId);
		expect(body.issue).toMatchObject({
			id: session.taskId,
			title: "Build the dashboard",
			content: "Build the dashboard",
		});
		expect(body.messages).toHaveLength(1);
		expect(body.messages[0]).toMatchObject({
			content: "Build the dashboard",
			taskId: session.taskId,
		});
		expect(cliCalls).toEqual([]);
		expect(events.map((event) => (event as { type: string }).type)).toEqual([
			"project.created",
			"issue.created",
			"chat.session.created",
			"issue.updated",
			"chat.message.created",
			"chat.session.updated",
		]);
	});

	it("creates and attaches an issue for legacy sessions without task ids", async () => {
		testDatabase = await createDrizzleServerTestDatabase();
		const app = createServerTestApp(testDatabase.db, {
			workspacePath: testDatabase.path,
		});
		await testDatabase.db.insert(chatSessionsTable).values({
			id: "legacy-session",
			workspaceId: "owner-1",
			projectId: null,
			taskId: null,
			title: "Untitled",
			pendingRequest: null,
			pendingQuestions: null,
			createdAt: "2026-05-13T00:00:00.000Z",
			updatedAt: "2026-05-13T00:00:00.000Z",
		});

		const response = await app(
			createJsonRequest("POST", "/api/chat/sessions/legacy-session/send", {
				content: "Legacy chat request",
			}),
		);

		expect(response.status).toBe(200);
		const body = (await response.json()) as {
			messages: Array<{ taskId: string | null }>;
			session: { projectId: string | null; taskId: string | null };
		};
		expect(body.session.projectId).toBe("default");
		expect(body.session.taskId).toBeTruthy();
		const taskId = body.session.taskId;
		if (!taskId) {
			throw new Error("Expected legacy session to have a task id");
		}
		expect(body.messages[0]?.taskId).toBe(taskId);

		const tasks = await testDatabase.db.select().from(boardTasksTable);
		const messages = await testDatabase.db.select().from(chatMessagesTable);
		expect(tasks).toHaveLength(1);
		expect(tasks[0]?.id).toBe(taskId);
		expect(messages[0]?.taskId).toBe(taskId);
	});
});
