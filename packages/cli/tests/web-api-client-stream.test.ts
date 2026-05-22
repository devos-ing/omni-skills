import { describe, expect, it } from "bun:test";
import { createApiClient } from "../../web/src/lib/api/client";
import { resolveWebServerProxyWsUrl } from "../../web/src/lib/api/web-client";

describe("web api client command streams", () => {
	it("streams CLI command events with an opt-in payload", async () => {
		const calls: Array<{ url: string; body: unknown }> = [];
		const WebSocketImpl = createMockWebSocket(calls);
		const client = createApiClient({
			baseUrl: "http://localhost:3000",
			WebSocketImpl,
		});
		const events: unknown[] = [];

		await client.streamCliCommand({ action: "projects" }, (event) =>
			events.push(event),
		);

		expect(calls[0]?.url).toBe("ws://localhost:3000/api/workflow");
		expect(calls[0]?.body).toEqual({
			type: "command",
			requestId: expect.any(String),
			request: { action: "projects" },
		});
		expect(events).toEqual([
			{ type: "stdout", text: "hello" },
			{
				type: "complete",
				result: { status: "succeeded", request: { action: "projects" } },
			},
		]);
	});

	it("resolves browser websocket stream endpoints", () => {
		expect(resolveWebServerProxyWsUrl({})).toBe("/api/workflow");
		expect(
			resolveWebServerProxyWsUrl({
				NEXT_PUBLIC_DEVOS_WORKFLOW_WS_URL: "ws://127.0.0.1:3001/api/workflow",
			}),
		).toBe("ws://127.0.0.1:3001/api/workflow");
	});
});

function createMockWebSocket(
	calls: Array<{ url: string; body: unknown }>,
): typeof WebSocket {
	class MockWebSocket {
		private listeners = new Map<string, Array<(event: MessageEvent) => void>>();

		constructor(private readonly url: string) {
			queueMicrotask(() => this.emit("open", {}));
		}

		addEventListener(event: string, listener: (event: MessageEvent) => void) {
			this.listeners.set(event, [
				...(this.listeners.get(event) ?? []),
				listener,
			]);
		}

		send(body: string): void {
			const parsed = JSON.parse(body);
			calls.push({ url: this.url, body: parsed });
			this.emit("message", {
				data: JSON.stringify({
					type: "stdout",
					requestId: parsed.requestId,
					text: "hello",
				}),
			});
			this.emit("message", {
				data: JSON.stringify({
					type: "complete",
					requestId: parsed.requestId,
					result: {
						status: "succeeded",
						request: { action: "projects" },
					},
				}),
			});
		}

		close(): void {}

		private emit(event: string, payload: Partial<MessageEvent>): void {
			for (const listener of this.listeners.get(event) ?? []) {
				listener(payload as MessageEvent);
			}
		}
	}
	return MockWebSocket as unknown as typeof WebSocket;
}
