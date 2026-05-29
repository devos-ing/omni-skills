import { describe, expect, it } from "bun:test";
import { formatTaskCreateError } from "../../web/src/components/task-create/task-create-chat-errors";
import { createApiClient } from "../../web/src/lib/api/client";

describe("web api client task create", () => {
	it("serializes clarification answers in chat task create payload", async () => {
		const calls: Array<{ url: string; body: unknown }> = [];
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			calls.push({
				url: String(input),
				body: init?.body ? JSON.parse(String(init.body)) : undefined,
			});
			return new Response(
				JSON.stringify({
					status: "created",
					issue: {
						id: "lin-1",
						identifier: "ROY-1",
						title: "Create a task",
						url: "https://linear.example/ROY-1",
					},
					task: {
						id: "task-1",
						taskKey: "TASK-000001",
						projectId: "default",
						title: "Create a task",
						content: "Task body",
						priority: 1,
						status: "open",
						dueDate: null,
						creatorId: "owner-1",
						linkedPr: "https://linear.example/ROY-1",
						createdAt: "2026-05-13T00:00:00.000Z",
						updatedAt: "2026-05-13T00:00:00.000Z",
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			fetchFn,
		});

		await client.createTask({
			request: "Create a task",
			projectId: "default",
			answers: [{ question: "Who is this for?", answer: "CLI users" }],
		});

		expect(calls).toEqual([
			{
				url: "http://localhost:3000/api/tasks/chat-create",
				body: {
					request: "Create a task",
					projectId: "default",
					answers: [{ question: "Who is this for?", answer: "CLI users" }],
				},
			},
		]);
	});

	it("allows chat task create payloads without project ids", async () => {
		const calls: Array<{ url: string; body: unknown }> = [];
		const fetchFn = (async (input: URL | RequestInfo, init?: RequestInit) => {
			calls.push({
				url: String(input),
				body: init?.body ? JSON.parse(String(init.body)) : undefined,
			});
			return new Response(
				JSON.stringify({
					status: "created",
					task: {
						id: "task-1",
						taskKey: "TASK-000001",
						projectId: null,
						title: "Create a task",
						content: "Task body",
						priority: 1,
						status: "open",
						dueDate: null,
						creatorId: "owner-1",
						linkedPr: null,
						createdAt: "2026-05-13T00:00:00.000Z",
						updatedAt: "2026-05-13T00:00:00.000Z",
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			);
		}) as typeof fetch;
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			fetchFn,
		});

		const response = await client.createTask({
			request: "Create a task",
		});

		expect(response.status).toBe("created");
		if (response.status !== "created") {
			throw new Error("Expected created task response");
		}
		expect(response.task.projectId).toBeNull();
		expect(calls).toEqual([
			{
				url: "http://localhost:3000/api/tasks/chat-create",
				body: {
					request: "Create a task",
				},
			},
		]);
	});

	it("normalizes legacy task descriptions in chat task create responses", async () => {
		const fetchFn = (async () =>
			new Response(
				JSON.stringify({
					status: "created",
					task: {
						id: "task-1",
						taskKey: "TASK-000001",
						projectId: null,
						title: "Create a task",
						description: "Legacy task body",
						priority: 1,
						status: "open",
						dueDate: null,
						creatorId: "owner-1",
						linkedPr: null,
						createdAt: "2026-05-13T00:00:00.000Z",
						updatedAt: "2026-05-13T00:00:00.000Z",
					},
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)) as unknown as typeof fetch;
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			fetchFn,
		});

		const response = await client.createTask({
			request: "Create a task",
		});

		expect(response).toMatchObject({
			status: "created",
			task: {
				content: "Legacy task body",
			},
		});
	});

	it("preserves recommended clarification options from chat task create", async () => {
		const fetchFn = (async () =>
			new Response(
				JSON.stringify({
					status: "needs_info",
					questions: [
						{
							question: "Which agent?",
							options: [
								{ label: "Codex", value: "codex", recommended: true },
								{ label: "Claude", value: "claude" },
							],
						},
					],
				}),
				{ status: 200, headers: { "content-type": "application/json" } },
			)) as unknown as typeof fetch;
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			fetchFn,
		});

		const response = await client.createTask({ request: "Create a task" });

		expect(response).toMatchObject({
			status: "needs_info",
			questions: [
				{
					options: [
						{ label: "Codex", value: "codex", recommended: true },
						{ label: "Claude", value: "claude" },
					],
				},
			],
		});
	});

	it("formats task creation failures as board task errors", () => {
		expect(
			formatTaskCreateError({
				status: "db_error",
				error: "Task creation returned invalid structured output",
			}),
		).toBe(
			"Board task creation failed: Task creation returned invalid structured output",
		);
	});
});
