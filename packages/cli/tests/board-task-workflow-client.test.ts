import { afterEach, describe, expect, it } from "bun:test";
import { createBoardTaskWorkflowClient } from "../src/features/workflow/board-task-workflow-client";
import { project } from "./smoke-fixtures";

interface WorkflowCall {
	url: string;
	body: {
		requestId: string;
		action: string;
		payload?: unknown;
	};
}

const previousWebSocket = globalThis.WebSocket;

afterEach(() => {
	globalThis.WebSocket = previousWebSocket;
});

describe("BoardTaskWorkflowClient", () => {
	it("polls tasks through workflow websocket frames", async () => {
		const calls = installWorkflowSocket();
		const config = project("project-1");
		const client = createBoardTaskWorkflowClient(config);

		expect((await client.fetchWork()).map((task) => task.identifier)).toEqual([
			"TASK-000001",
		]);
		expect(
			(await client.fetchWork("TASK-000002")).map((task) => task.identifier),
		).toEqual(["TASK-000002"]);
		expect(await client.isAssignedState("todo")).toBe(true);
		expect(await client.isAssignedState("planning")).toBe(false);
		expect(calls.map((call) => call.body.action)).toEqual([
			"tasks.list",
			"tasks.list",
		]);
	});

	it("routes stage, comment, and PR mutations through workflow websocket", async () => {
		const calls = installWorkflowSocket();
		const config = project("project-1");
		config.repo.owner = "acme";
		config.repo.name = "project";
		const client = createBoardTaskWorkflowClient(config);

		await client.markStage("task-1", "implementing");
		await client.markStage("task-1", "pr_created");
		await client.comment("task-1", "Implementation started.");
		await client.linkPullRequest?.("task-1", {
			number: 42,
			url: "https://github.com/acme/project/pull/42",
			branch: "codex/task-000001",
			title: "Task PR",
		});

		expect(calls.map((call) => call.body)).toMatchObject([
			{
				action: "tasks.update",
				payload: { taskId: "task-1", values: { status: "implementing" } },
			},
			{
				action: "tasks.update",
				payload: { taskId: "task-1", values: { status: "reviewing" } },
			},
			{
				action: "tasks.addComment",
				payload: { taskId: "task-1", body: "Implementation started." },
			},
			{
				action: "tasks.linkPullRequest",
				payload: {
					taskId: "task-1",
					repository: "acme/project",
					pullRequest: { number: 42 },
				},
			},
		]);
	});

	it("returns review-only tasks with websocket pull request refs", async () => {
		installWorkflowSocket();
		const client = createBoardTaskWorkflowClient(project("project-1"));

		const [task] = await client.fetchReviewOnlyWork();

		expect(task?.identifier).toBe("TASK-000003");
		expect(task?.pullRequest?.url).toBe(
			"https://github.com/acme/project/pull/7",
		);
		expect(task?.pullRequest?.number).toBe(7);
	});
});

function installWorkflowSocket(): WorkflowCall[] {
	const calls: WorkflowCall[] = [];
	globalThis.WebSocket = class FakeWorkflowSocket extends EventTarget {
		constructor(readonly url: string) {
			super();
			queueMicrotask(() => this.dispatchEvent(new Event("open")));
		}

		send(message: string): void {
			const body = JSON.parse(message) as WorkflowCall["body"];
			calls.push({ url: this.url, body });
			const payload = payloadForAction(body.action, body.payload);
			queueMicrotask(() => {
				this.dispatchEvent(
					new MessageEvent("message", {
						data: JSON.stringify({
							type: "workflow.response",
							requestId: body.requestId,
							action: body.action,
							status: "ok",
							payload,
						}),
					}),
				);
			});
		}

		close(): void {}
	} as unknown as typeof WebSocket;
	return calls;
}

function payloadForAction(action: string, payload: unknown): unknown {
	if (action === "tasks.list") {
		return [
			task({ id: "task-1", taskKey: "TASK-000001", status: "todo" }),
			task({ id: "task-2", taskKey: "TASK-000002", status: "planning" }),
			task({
				id: "task-3",
				taskKey: "TASK-000003",
				status: "reviewing",
				linkedPr: "https://github.com/acme/project/pull/7",
				pullRequest: {
					number: 7,
					url: "https://github.com/acme/project/pull/7",
					branch: "codex/task-000003",
					title: "Task PR",
				},
			}),
			task({ id: "task-4", taskKey: "TASK-000004", projectId: "other" }),
		];
	}
	if (action === "tasks.update" && isRecord(payload)) {
		return task({ id: String(payload.taskId), status: "implementing" });
	}
	return task({ id: "task-1", taskKey: "TASK-000001" });
}

function task(overrides: Record<string, unknown> = {}) {
	return {
		id: "task-1",
		taskKey: "TASK-000001",
		projectId: "project-1",
		title: "Task",
		content: "Task content",
		priority: 1,
		status: "planning",
		dueDate: null,
		creatorId: "owner-1",
		linkedPr: null,
		linearIssueId: null,
		linearIdentifier: null,
		linearUrl: null,
		createdAt: "2026-05-12T00:00:00.000Z",
		updatedAt: "2026-05-12T00:00:00.000Z",
		...overrides,
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
