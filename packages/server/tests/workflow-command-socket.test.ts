import { describe, expect, it } from "bun:test";
import { EventEmitter } from "node:events";
import type { ServerDatabase } from "devos-db";
import { WebSocket } from "ws";
import type { WorkflowCommandBroker } from "../src/workflow-data/workflow-command-broker.types";
import { bindWorkflowDataClient } from "../src/workflow-data/workflow-data-socket";
import type { WorkflowDataSocket } from "../src/workflow-data/workflow-data-socket.types";

describe("workflow command websocket routing", () => {
	it("routes ping, browser command, and worker frames on the workflow socket", async () => {
		const broker = createFakeCommandBroker();
		const socket = new FakeWorkflowDataSocket();
		bindWorkflowDataClient(socket, {
			commandBroker: broker,
			db: {} as ServerDatabase["db"],
		});

		socket.emitMessage(JSON.stringify({ type: "ping", requestId: "ping-1" }));
		expect(JSON.parse(await socket.nextSend())).toEqual({
			type: "pong",
			requestId: "ping-1",
		});

		socket.emitMessage(
			JSON.stringify({
				type: "command",
				requestId: "cmd-1",
				request: { action: "projects" },
			}),
		);
		expect(JSON.parse(await socket.nextSend())).toEqual({
			type: "stdout",
			requestId: "cmd-1",
			text: "ok",
		});

		socket.emitMessage(
			JSON.stringify({ type: "cli.worker.ready", workerId: "worker-1" }),
		);
		socket.emitMessage(
			JSON.stringify({ type: "complete", requestId: "cmd-2", result: {} }),
		);
		expect(broker.registeredWorkerId).toBe("worker-1");
		expect(broker.workerFrames).toEqual([
			{ type: "complete", requestId: "cmd-2", result: {} },
		]);
	});
});

class FakeWorkflowDataSocket
	extends EventEmitter
	implements WorkflowDataSocket
{
	readyState: number = WebSocket.OPEN;
	readonly sent: string[] = [];
	private sendResolver: ((message: string) => void) | undefined;

	send(message: string): void {
		if (this.sendResolver) {
			this.sendResolver(message);
			this.sendResolver = undefined;
			return;
		}
		this.sent.push(message);
	}

	close(): void {
		this.readyState = WebSocket.CLOSED;
	}

	emitMessage(message: string): void {
		this.emit("message", message);
	}

	nextSend(): Promise<string> {
		const sent = this.sent.shift();
		if (sent) {
			return Promise.resolve(sent);
		}
		return new Promise((resolve) => {
			this.sendResolver = resolve;
		});
	}
}

function createFakeCommandBroker(): WorkflowCommandBroker & {
	registeredWorkerId?: string;
	workerFrames: unknown[];
} {
	const broker: WorkflowCommandBroker & {
		registeredWorkerId?: string;
		workerFrames: unknown[];
	} = {
		registeredWorkerId: undefined,
		workerFrames: [],
		dispatchCommand: async (frame, emit) => {
			const result = { status: "succeeded" as const, request: frame.request };
			emit({ type: "stdout", requestId: frame.requestId, text: "ok" });
			return result;
		},
		execute: async (request) => ({ status: "succeeded", request }),
		executeStream: async (request) => ({ status: "succeeded", request }),
		getHistory: () => [],
		handleWorkerFrame: (frame) => {
			broker.workerFrames.push(frame);
		},
		registerWorker: (_socket, workerId) => {
			broker.registeredWorkerId = workerId;
		},
	};
	return broker;
}
