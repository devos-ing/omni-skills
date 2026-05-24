import { describe, expect, it } from "bun:test";
import {
	buildWorkflowComputerRegistration,
	handleWorkerMessage,
	parseWorkerInboundFrame,
	startWorkflowCommandWorker,
} from "../src/features/daemon";
import type { WorkflowCommandWorkerSocket } from "../src/features/daemon";

describe("workflow command worker", () => {
	it("registers with the server workflow socket when opened", () => {
		const WebSocketImpl = createFakeWebSocketConstructor();
		startWorkflowCommandWorker({
			cwd: "/repo",
			computer: {
				id: "roys-macbook",
				name: "Roy's MacBook",
				hostname: "roys-macbook.local",
				platform: "darwin",
				arch: "arm64",
				cwd: "/repo",
				startedAt: "2026-05-24T00:00:00.000Z",
				processId: 123,
				user: "roy",
			},
			env: { DEVOS_WORKFLOW_WS_URL: "ws://server.test/api/workflow" },
			WebSocketImpl,
			workerId: "worker-1",
		});

		const socket = WebSocketImpl.instances[0];
		socket?.open();

		expect(socket?.url).toBe("ws://server.test/api/workflow");
		expect(socket?.sent.map((message) => JSON.parse(message))).toEqual([
			{
				type: "cli.worker.ready",
				workerId: "worker-1",
				computer: {
					id: "roys-macbook",
					name: "Roy's MacBook",
					hostname: "roys-macbook.local",
					platform: "darwin",
					arch: "arm64",
					cwd: "/repo",
					startedAt: "2026-05-24T00:00:00.000Z",
					processId: 123,
					user: "roy",
				},
			},
		]);
	});

	it("builds a stable computer registration for the worker process", () => {
		const registration = buildWorkflowComputerRegistration({
			cwd: "/repo",
			env: { DEVOS_COMPUTER_NAME: "Roy's MacBook" },
		});

		expect(registration).toMatchObject({
			id: "roy-s-macbook",
			name: "Roy's MacBook",
			cwd: "/repo",
			processId: process.pid,
		});
		expect(registration.hostname).toBeTruthy();
		expect(registration.platform).toBeTruthy();
		expect(registration.arch).toBeTruthy();
		expect(Date.parse(registration.startedAt)).not.toBeNaN();
	});

	it("executes dispatch frames and streams command events back", async () => {
		const socket = new FakeWorkerSocket("ws://server.test/api/workflow");

		await handleWorkerMessage(
			JSON.stringify({
				type: "cli.dispatch",
				requestId: "req-1",
				request: { action: "onboard" },
			}),
			socket,
			{
				executeStream: async (request, emit) => {
					emit({ type: "stdout", text: "hello" });
					const result = { status: "succeeded" as const, request };
					emit({ type: "complete", result });
					return result;
				},
			},
		);

		expect(socket.sent.map((message) => JSON.parse(message))).toEqual([
			{ type: "stdout", requestId: "req-1", text: "hello" },
			{
				type: "complete",
				requestId: "req-1",
				result: { status: "succeeded", request: { action: "onboard" } },
			},
		]);
	});

	it("reconnects after the workflow socket closes", () => {
		const WebSocketImpl = createFakeWebSocketConstructor();
		const scheduler = createScheduler();
		startWorkflowCommandWorker({
			cwd: "/repo",
			env: { DEVOS_WORKFLOW_WS_URL: "ws://server.test/api/workflow" },
			reconnectDelayMs: 25,
			scheduler: scheduler.schedule,
			WebSocketImpl,
		});

		WebSocketImpl.instances[0]?.close();
		expect(scheduler.delayMs).toBe(25);
		scheduler.fire();

		expect(WebSocketImpl.instances).toHaveLength(2);
	});

	it("parses only ping and dispatch frames from the server", () => {
		expect(parseWorkerInboundFrame("{nope")).toBeUndefined();
		expect(
			parseWorkerInboundFrame(
				JSON.stringify({ type: "ping", requestId: "ping-1" }),
			),
		).toEqual({ type: "ping", requestId: "ping-1" });
	});
});

class FakeWorkerSocket implements WorkflowCommandWorkerSocket {
	readonly sent: string[] = [];
	private readonly listeners = new Map<
		string,
		Array<(event: { data?: unknown }) => void>
	>();

	constructor(readonly url: string) {}

	send(message: string): void {
		this.sent.push(message);
	}

	close(): void {
		this.emit("close", {});
	}

	addEventListener(
		event: "open" | "message" | "error" | "close",
		listener: (event: { data?: unknown }) => void,
	): void {
		this.listeners.set(event, [...(this.listeners.get(event) ?? []), listener]);
	}

	open(): void {
		this.emit("open", {});
	}

	private emit(event: string, payload: { data?: unknown }): void {
		for (const listener of this.listeners.get(event) ?? []) {
			listener(payload);
		}
	}
}

function createFakeWebSocketConstructor(): (new (
	url: string,
) => FakeWorkerSocket) & { instances: FakeWorkerSocket[] } {
	class FakeWebSocket extends FakeWorkerSocket {
		static readonly instances: FakeWorkerSocket[] = [];
		constructor(url: string) {
			super(url);
			FakeWebSocket.instances.push(this);
		}
	}
	return FakeWebSocket;
}

function createScheduler(): {
	delayMs: number | undefined;
	fire(): void;
	schedule: (callback: () => void, delayMs: number) => { cancel(): void };
} {
	let callback: (() => void) | undefined;
	const scheduler: {
		delayMs: number | undefined;
		fire(): void;
		schedule: (callback: () => void, delayMs: number) => { cancel(): void };
	} = {
		delayMs: undefined,
		fire: () => callback?.(),
		schedule(next: () => void, delayMs: number) {
			callback = next;
			scheduler.delayMs = delayMs;
			return {
				cancel: () => {
					callback = undefined;
				},
			};
		},
	};
	return scheduler;
}
