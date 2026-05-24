import { afterEach, describe, expect, it } from "bun:test";
import { createBoardTaskCreator } from "../src/features/task-intake/board-task-creator";
import { project } from "./smoke-fixtures";

const previousWebSocket = globalThis.WebSocket;

afterEach(() => {
	globalThis.WebSocket = previousWebSocket;
});

describe("createBoardTaskCreator", () => {
	it("creates intake board tasks through the workflow websocket", async () => {
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
					payload: { title: string; description: string; projectId: string };
				};
				calls.push({ action: body.action, payload: body.payload });
				queueMicrotask(() => {
					this.dispatchEvent(
						new MessageEvent("message", {
							data: JSON.stringify({
								type: "workflow.response",
								requestId: body.requestId,
								action: body.action,
								status: "ok",
								payload: createdTask(body.payload.title),
							}),
						}),
					);
				});
			}

			close(): void {}
		} as unknown as typeof WebSocket;
		const creator = createBoardTaskCreator(project("project-1"));

		const task = await creator.createTask({
			title: "Add task CLI",
			description: "Create tasks from CLI.",
		});

		expect(task.taskKey).toBe("TASK(project-1)-1");
		expect(calls).toEqual([
			{
				action: "tasks.createIntakeTask",
				payload: {
					projectId: "project-1",
					title: "Add task CLI",
					description: "Create tasks from CLI.",
				},
			},
		]);
	});
});

function createdTask(title: string) {
	return {
		id: "task-1",
		taskKey: "TASK(project-1)-1",
		projectId: "project-1",
		title,
		content: "Create tasks from CLI.",
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
	};
}
