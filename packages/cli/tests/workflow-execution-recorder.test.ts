import { afterEach, describe, expect, it } from "bun:test";
import { emitWorkflowProgress } from "../src/features/server";
import { createWorkflowExecutionRecorder } from "../src/features/workflow/workflow-execution-recorder";
import { project, state } from "./smoke-fixtures";

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

describe("WorkflowExecutionRecorder", () => {
	it("forwards agent log identity metadata to append stream payloads", async () => {
		const calls = installWorkflowSocket();
		const config = project("project-1");
		const runState = state(config, "TASK-1", "in_progress");
		runState.issue.id = "task-1";

		const recorder = createWorkflowExecutionRecorder(config, runState);
		await recorder.start();
		emitWorkflowProgress({
			kind: "log",
			projectId: "project-1",
			taskId: "task-1",
			issueKey: "TASK-1",
			stage: "implementing",
			stream: "stdout",
			level: "info",
			message: "agent stream line\n",
			agentRole: "implementing",
			agentBackend: "codex",
			agentModel: "gpt-5.4",
			phrase: "implementing",
		} as Parameters<typeof emitWorkflowProgress>[0]);
		await recorder.finish("succeeded");

		const append = calls.find(
			(call) => call.body.action === "taskExecutions.appendStream",
		);
		expect(append?.body.payload).toMatchObject({
			projectId: "project-1",
			taskId: "task-1",
			issueKey: "TASK-1",
			stage: "implementing",
			stream: "stdout",
			text: "agent stream line\n",
			agentRole: "implementing",
			agentBackend: "codex",
			agentModel: "gpt-5.4",
			phrase: "implementing",
		});
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
			queueMicrotask(() => {
				this.dispatchEvent(
					new MessageEvent("message", {
						data: JSON.stringify({
							type: "workflow.response",
							requestId: body.requestId,
							action: body.action,
							status: "ok",
						}),
					}),
				);
			});
		}

		close(): void {}
	} as unknown as typeof WebSocket;
	return calls;
}
