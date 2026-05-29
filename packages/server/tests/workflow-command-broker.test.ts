import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import { WebSocket } from "ws";
import type { WorkflowDataSocket } from "../src/workflow-data/types/workflow-data-socket.types";
import type { WorkflowCommandStreamFrame } from "../src/workflow-data/types/workflow-data.types";
import { createWorkflowCommandBroker } from "../src/workflow-data/workflow-command-broker";

describe("workflow command broker", () => {
	it("fails command dispatch clearly when no CLI worker is connected", async () => {
		const broker = createWorkflowCommandBroker();
		const frames: WorkflowCommandStreamFrame[] = [];

		await broker.dispatchCommand(
			{ type: "command", requestId: "req-1", request: { action: "onboard" } },
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
					request: { action: "onboard" },
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
		broker.registerWorker(worker, "worker-1", {
			id: "roys-macbook",
			name: "Roy's MacBook",
			hostname: "roys-macbook.local",
			platform: "darwin",
			arch: "arm64",
			cwd: "/repo",
			startedAt: "2026-05-24T00:00:00.000Z",
			processId: 123,
			user: "roy",
		});

		const done = broker.dispatchCommand(
			{ type: "command", requestId: "req-2", request: { action: "onboard" } },
			(frame) => frames.push(frame),
		);

		expect(JSON.parse(worker.sent[0] ?? "")).toEqual({
			type: "cli.dispatch",
			requestId: "req-2",
			request: { action: "onboard" },
		});
		broker.handleWorkerFrame({
			type: "stdout",
			requestId: "req-2",
			text: "hello",
		});
		broker.handleWorkerFrame({
			type: "complete",
			requestId: "req-2",
			result: { status: "succeeded", request: { action: "onboard" } },
		});

		await done;
		expect(frames).toEqual([
			{ type: "stdout", requestId: "req-2", text: "hello" },
			{
				type: "complete",
				requestId: "req-2",
				result: { status: "succeeded", request: { action: "onboard" } },
			},
		]);
		expect(broker.getHistory()[0]).toMatchObject({
			request: { action: "onboard" },
			status: "succeeded",
		});
		expect(broker.listComputers()[0]).toMatchObject({
			id: "roys-macbook",
			workerId: "worker-1",
			status: "online",
		});
	});

	it("queues later commands until the active CLI command completes", async () => {
		const broker = createWorkflowCommandBroker();
		const worker = new FakeWorkflowSocket();
		broker.registerWorker(worker, "worker-1");

		const running = broker.dispatchCommand(
			{ type: "command", requestId: "req-run", request: { action: "run" } },
			() => {},
		);
		const queued = broker.dispatchCommand(
			{
				type: "command",
				requestId: "req-task",
				request: { action: "task", taskAction: "create" },
			},
			() => {},
		);

		expect(worker.sent).toHaveLength(1);
		expect(JSON.parse(worker.sent[0] ?? "")).toMatchObject({
			requestId: "req-run",
		});

		broker.handleWorkerFrame({
			type: "complete",
			requestId: "req-run",
			result: { status: "succeeded", request: { action: "run" } },
		});

		await running;
		expect(worker.sent).toHaveLength(2);
		expect(JSON.parse(worker.sent[1] ?? "")).toMatchObject({
			requestId: "req-task",
		});

		broker.handleWorkerFrame({
			type: "complete",
			requestId: "req-task",
			result: {
				status: "succeeded",
				request: { action: "task", taskAction: "create" },
			},
		});

		await queued;
		expect(broker.getHistory().map((entry) => entry.request.action)).toEqual([
			"run",
			"task",
		]);
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

	it("marks registered computers offline when their worker disconnects", () => {
		const broker = createWorkflowCommandBroker();
		const worker = new FakeWorkflowSocket();
		broker.registerWorker(worker, "worker-1", {
			id: "computer-1",
			name: "Computer 1",
			hostname: "computer-1.local",
			platform: "darwin",
			arch: "arm64",
			cwd: "/repo",
			startedAt: "2026-05-24T00:00:00.000Z",
		});

		worker.close();

		expect(broker.listComputers()[0]).toMatchObject({
			id: "computer-1",
			status: "offline",
			workerId: "worker-1",
		});
		expect(broker.listComputers()[0]?.disconnectedAt).toBeTruthy();
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
