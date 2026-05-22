import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import { createWorkflowCommandBroker } from "../src/workflow-data/workflow-command-broker";
import type { WorkflowDataSocket } from "../src/workflow-data/workflow-data-socket.types";
import type { WorkflowCommandStreamFrame } from "../src/workflow-data/workflow-data.types";

describe("workflow command broker", () => {
	it("fails command dispatch clearly when no CLI worker is connected", async () => {
		const broker = createWorkflowCommandBroker();
		const frames: WorkflowCommandStreamFrame[] = [];

		await broker.dispatchCommand(
			{ type: "command", requestId: "req-1", request: { action: "projects" } },
			(frame) => frames.push(frame),
		);

		expect(frames).toEqual([
			{
				type: "error",
				requestId: "req-1",
				error: "No CLI worker connected to /api/workflow",
			},
			{
				type: "complete",
				requestId: "req-1",
				result: {
					status: "failed",
					request: { action: "projects" },
					error: "No CLI worker connected to /api/workflow",
				},
			},
		]);
		expect(broker.getHistory()).toHaveLength(1);
	});

	it("forwards commands to the active CLI worker and returns stream frames", async () => {
		const broker = createWorkflowCommandBroker();
		const worker = new FakeWorkflowSocket();
		const frames: WorkflowCommandStreamFrame[] = [];
		broker.registerWorker(worker, "worker-1");

		const done = broker.dispatchCommand(
			{ type: "command", requestId: "req-2", request: { action: "projects" } },
			(frame) => frames.push(frame),
		);

		expect(JSON.parse(worker.sent[0] ?? "")).toEqual({
			type: "cli.dispatch",
			requestId: "req-2",
			request: { action: "projects" },
		});
		broker.handleWorkerFrame({
			type: "stdout",
			requestId: "req-2",
			text: "hello",
		});
		broker.handleWorkerFrame({
			type: "complete",
			requestId: "req-2",
			result: { status: "succeeded", request: { action: "projects" } },
		});

		await done;
		expect(frames).toEqual([
			{ type: "stdout", requestId: "req-2", text: "hello" },
			{
				type: "complete",
				requestId: "req-2",
				result: { status: "succeeded", request: { action: "projects" } },
			},
		]);
		expect(broker.getHistory()[0]).toMatchObject({
			request: { action: "projects" },
			status: "succeeded",
		});
	});

	it("fails pending command dispatch when the active worker closes", async () => {
		const broker = createWorkflowCommandBroker();
		const worker = new FakeWorkflowSocket();
		const frames: WorkflowCommandStreamFrame[] = [];
		broker.registerWorker(worker, "worker-1");

		const done = broker.dispatchCommand(
			{ type: "command", requestId: "req-3", request: { action: "run" } },
			(frame) => frames.push(frame),
		);
		worker.close();

		await expect(done).resolves.toEqual({
			status: "failed",
			request: { action: "run" },
			error: "CLI worker disconnected: worker-1",
		});
		expect(frames.at(-1)).toEqual({
			type: "complete",
			requestId: "req-3",
			result: {
				status: "failed",
				request: { action: "run" },
				error: "CLI worker disconnected: worker-1",
			},
		});
	});
});

class FakeWorkflowSocket extends EventEmitter implements WorkflowDataSocket {
	readyState: number = WebSocket.OPEN;
	readonly sent: string[] = [];

	send(message: string): void {
		this.sent.push(message);
	}

	close(): void {
		this.readyState = WebSocket.CLOSED;
		this.emit("close");
	}
}
