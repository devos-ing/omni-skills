import type {
	CliDispatchStreamEvent,
	CliDispatchStreamHandler,
	CliDispatchStreamRequest,
	HealthRequestOptions,
} from "./client.types";

export interface DispatchStreamApiMethods {
	streamCliDispatch(
		request: CliDispatchStreamRequest,
		onEvent: CliDispatchStreamHandler,
		options?: HealthRequestOptions,
	): Promise<void>;
}

export function createDispatchStreamApiMethods(
	wsUrl: string,
	WebSocketImpl: typeof WebSocket = WebSocket,
): DispatchStreamApiMethods {
	return {
		streamCliDispatch(request, onEvent, options) {
			return streamDispatchOverWebSocket(
				resolveBrowserWsUrl(wsUrl),
				WebSocketImpl,
				request,
				onEvent,
				options,
			);
		},
	};
}

function streamDispatchOverWebSocket(
	url: string,
	WebSocketImpl: typeof WebSocket,
	request: CliDispatchStreamRequest,
	onEvent: CliDispatchStreamHandler,
	options?: HealthRequestOptions,
): Promise<void> {
	const requestId = crypto.randomUUID();
	const socket = new WebSocketImpl(url);
	return new Promise((resolve, reject) => {
		let settled = false;
		const settle = (callback: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			options?.signal?.removeEventListener("abort", abort);
			callback();
		};
		const abort = () => {
			socket.close();
			settle(() => reject(new DOMException("Aborted", "AbortError")));
		};
		options?.signal?.addEventListener("abort", abort, { once: true });
		socket.addEventListener("open", () => {
			socket.send(JSON.stringify({ type: "command", requestId, request }));
		});
		socket.addEventListener("message", (event) => {
			const frame = parseWebSocketFrame(String(event.data));
			if (!frame || frame.requestId !== requestId) {
				return;
			}
			if (isDispatchStreamFrame(frame)) {
				onEvent(toDispatchStreamEvent(frame));
			}
			if (frame.type === "complete") {
				socket.close();
				settle(resolve);
			}
		});
		socket.addEventListener("error", () => {
			settle(() => reject(new Error("CLI stream websocket failed")));
		});
		socket.addEventListener("close", () => {
			settle(() => reject(new Error("CLI stream websocket closed")));
		});
	});
}

function isDispatchStreamFrame(
	frame:
		| (CliDispatchStreamEvent & { requestId: string })
		| { type: "ready" | "pong"; requestId?: string },
): frame is CliDispatchStreamEvent & { requestId: string } {
	return frame.type !== "ready" && frame.type !== "pong";
}

function parseWebSocketFrame(
	input: string,
):
	| (CliDispatchStreamEvent & { requestId: string })
	| { type: "ready" | "pong"; requestId?: string }
	| undefined {
	try {
		return JSON.parse(input);
	} catch {
		return undefined;
	}
}

function toDispatchStreamEvent(
	frame: CliDispatchStreamEvent & { requestId: string },
): CliDispatchStreamEvent {
	const { requestId: _requestId, ...event } = frame;
	return event;
}

function resolveBrowserWsUrl(wsUrl: string): string {
	if (typeof window === "undefined" || !wsUrl.startsWith("/")) {
		return wsUrl;
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${wsUrl}`;
}
