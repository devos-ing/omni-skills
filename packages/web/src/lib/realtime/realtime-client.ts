"use client";

import { parseRealtimeEvent } from "./realtime-event-parser";
import type {
	RealtimeEvent,
	RealtimeSubscription,
} from "./types/realtime-events.types";

export { parseRealtimeEvent } from "./realtime-event-parser";

const DEFAULT_REALTIME_URL = "/api/events";
const RECONNECT_DELAYS_MS = [1000, 2000, 5000] as const;

export interface RealtimeClientOptions {
	url?: string;
	WebSocketImpl?: typeof WebSocket;
	onEvent(event: RealtimeEvent): void;
	onStatus(status: "connecting" | "connected" | "disconnected"): void;
	onError(error: string): void;
}

export function subscribeToRealtimeEvents(
	options: RealtimeClientOptions,
): RealtimeSubscription {
	const WebSocketImpl = options.WebSocketImpl ?? WebSocket;
	let socket: WebSocket | null = null;
	let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
	let closed = false;
	let reconnectAttempt = 0;

	const connect = (): void => {
		options.onStatus("connecting");
		socket = new WebSocketImpl(resolveBrowserRealtimeUrl(options.url));
		socket.addEventListener("open", () => {
			reconnectAttempt = 0;
			options.onStatus("connected");
		});
		socket.addEventListener("message", (event) => {
			try {
				options.onEvent(parseRealtimeEvent(String(event.data)));
			} catch (error) {
				options.onError(error instanceof Error ? error.message : String(error));
			}
		});
		socket.addEventListener("error", () => {
			options.onError("Realtime websocket failed");
		});
		socket.addEventListener("close", () => {
			options.onStatus("disconnected");
			if (!closed) {
				scheduleReconnect();
			}
		});
	};

	const scheduleReconnect = (): void => {
		const delay =
			RECONNECT_DELAYS_MS[
				Math.min(reconnectAttempt, RECONNECT_DELAYS_MS.length - 1)
			];
		reconnectAttempt += 1;
		reconnectTimer = setTimeout(connect, delay);
	};

	connect();

	return {
		close(): void {
			closed = true;
			if (reconnectTimer) {
				clearTimeout(reconnectTimer);
			}
			socket?.close();
		},
	};
}

export function resolveBrowserRealtimeUrl(url = DEFAULT_REALTIME_URL): string {
	if (typeof window === "undefined" || !url.startsWith("/")) {
		return url;
	}
	const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
	return `${protocol}//${window.location.host}${url}`;
}
