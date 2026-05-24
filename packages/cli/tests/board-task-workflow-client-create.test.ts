import { afterEach, describe, expect, it } from "bun:test";
import { createBoardTaskWorkflowClient } from "../src/features/workflow/board-task-workflow-client";
import { project } from "./smoke-fixtures";

const previousWebSocket = globalThis.WebSocket;

afterEach(() => {
	globalThis.WebSocket = previousWebSocket;
});

describe("BoardTaskWorkflowClient task creation", () => {
	it("creates backlog and planned tasks through workflow websocket", async () => {
		const calls = installWorkflowSocket();
		const client = createBoardTaskWorkflowClient(project("project-1"));
		const backlog = await client.createBacklogTask({
			title: "Backlog task",
			description: "Keep in backlog.",
		});
		const todo = await client.createTodoIssueFromPlan(
			{
				id: "parent-1",
				key: "TASK(project-1)-1",
				title: "Parent",
				url: "devos://tasks/parent-1",
			},
			{ title: "Planned task", description: "Ready to run." },
		);

		expect(backlog.identifier).toBe("TASK(project-1)-1");
		expect(todo.identifier).toBe("TASK(project-1)-2");
		expect(calls.map((call) => call.action)).toEqual([
			"tasks.createWorkflowTask",
			"tasks.createWorkflowTask",
		]);
		expect(calls.map((call) => call.payload)).toMatchObject([
			{ title: "Backlog task", status: "planning" },
			{ title: "Planned task", status: "todo" },
		]);
	});
});

function installWorkflowSocket(): Array<{ action: string; payload: unknown }> {
	const calls: Array<{ action: string; payload: unknown }> = [];
	globalThis.WebSocket = class FakeWorkflowSocket extends EventTarget {
		constructor(_url: string) {
			super();
			queueMicrotask(() => this.dispatchEvent(new Event("open")));
		}

		send(message: string): void {
			const body = JSON.parse(message) as {
				requestId: string;
				action: string;
				payload: { title?: string; status?: string };
			};
			calls.push({ action: body.action, payload: body.payload });
			const index = calls.length;
			queueMicrotask(() => {
				this.dispatchEvent(
					new MessageEvent("message", {
						data: JSON.stringify({
							type: "workflow.response",
							requestId: body.requestId,
							action: body.action,
							status: "ok",
							payload: {
								id: `task-${index}`,
								taskKey: `TASK(project-1)-${index}`,
								projectId: "project-1",
								title: body.payload.title,
								content: "Task content",
								priority: 1,
								status: body.payload.status,
								dueDate: null,
								creatorId: "owner-1",
								linkedPr: null,
								linearIssueId: null,
								linearIdentifier: null,
								linearUrl: null,
								createdAt: "2026-05-12T00:00:00.000Z",
								updatedAt: "2026-05-12T00:00:00.000Z",
							},
						}),
					}),
				);
			});
		}

		close(): void {}
	} as unknown as typeof WebSocket;
	return calls;
}
