import { describe, expect, it } from "bun:test";
import { createCliDaemonClient } from "../src/daemon/daemon-client";

describe("createCliDaemonClient", () => {
	it("dispatches command frames and emits daemon stream events", async () => {
		const calls: unknown[] = [];
		const WebSocketImpl = createMockWebSocket(calls);
		const client = createCliDaemonClient({
			url: "ws://daemon.test",
			WebSocketImpl,
		});
		const events: unknown[] = [];

		const result = await client.executeStream({ action: "projects" }, (event) =>
			events.push(event),
		);

		expect(calls).toEqual([
			{
				type: "command",
				requestId: expect.any(String),
				request: { action: "projects" },
			},
		]);
		expect(events).toEqual([
			{ type: "stdout", text: "hello" },
			{
				type: "complete",
				result: {
					status: "succeeded",
					request: { action: "projects" },
				},
			},
		]);
		expect(result.status).toBe("succeeded");
		expect(client.getHistory()).toHaveLength(1);
	});
});

function createMockWebSocket(calls: unknown[]): typeof WebSocket {
	class MockWebSocket {
		private listeners = new Map<string, Array<(event: MessageEvent) => void>>();

		constructor(_url: string) {
			queueMicrotask(() => this.emit("open", {}));
		}

		addEventListener(event: string, listener: (event: MessageEvent) => void) {
			this.listeners.set(event, [
				...(this.listeners.get(event) ?? []),
				listener,
			]);
		}

		send(body: string): void {
			const frame = JSON.parse(body);
			calls.push(frame);
			this.emit("message", {
				data: JSON.stringify({
					type: "stdout",
					requestId: frame.requestId,
					text: "hello",
				}),
			});
			this.emit("message", {
				data: JSON.stringify({
					type: "complete",
					requestId: frame.requestId,
					result: { status: "succeeded", request: frame.request },
				}),
			});
		}

		close(): void {
			this.emit("close", {});
		}

		private emit(event: string, payload: Partial<MessageEvent>): void {
			for (const listener of this.listeners.get(event) ?? []) {
				listener(payload as MessageEvent);
			}
		}
	}
	return MockWebSocket as unknown as typeof WebSocket;
}
