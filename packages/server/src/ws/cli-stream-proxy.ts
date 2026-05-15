import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import type {
	CliStreamProxy,
	CliStreamProxyOptions,
} from "./cli-stream-proxy.types";

export function attachCliStreamProxy(
	options: CliStreamProxyOptions,
): CliStreamProxy {
	const webSocketServer = new WebSocketServer({ noServer: true });
	const onUpgrade = (
		request: IncomingMessage,
		socket: Duplex,
		head: Buffer,
	): void => {
		const url = new URL(request.url ?? "/", "http://localhost");
		if (url.pathname !== options.path) {
			return;
		}
		webSocketServer.handleUpgrade(request, socket, head, (client) => {
			webSocketServer.emit("connection", client, request);
		});
	};

	webSocketServer.on("connection", (client) => {
		proxyClientToDaemon(client, options.daemonUrl);
	});
	options.server.on("upgrade", onUpgrade);

	return {
		close: () =>
			new Promise((resolve, reject) => {
				options.server.off("upgrade", onUpgrade);
				webSocketServer.close((error) => (error ? reject(error) : resolve()));
			}),
	};
}

function proxyClientToDaemon(client: WebSocket, daemonUrl: string): void {
	const daemon = new WebSocket(daemonUrl);
	const queuedMessages: WebSocket.RawData[] = [];

	daemon.on("open", () => {
		for (const message of queuedMessages.splice(0)) {
			daemon.send(message);
		}
	});
	daemon.on("message", (message) => {
		if (client.readyState === WebSocket.OPEN) {
			client.send(message);
		}
	});
	daemon.on("error", () => {
		sendProxyError(client, "CLI daemon websocket connection failed");
	});
	daemon.on("close", () => {
		if (client.readyState === WebSocket.OPEN) {
			client.close();
		}
	});
	client.on("message", (message) => {
		if (daemon.readyState === WebSocket.OPEN) {
			daemon.send(message);
			return;
		}
		queuedMessages.push(message);
	});
	client.on("close", () => {
		if (
			daemon.readyState === WebSocket.OPEN ||
			daemon.readyState === WebSocket.CONNECTING
		) {
			daemon.close();
		}
	});
}

function sendProxyError(client: WebSocket, error: string): void {
	if (client.readyState !== WebSocket.OPEN) {
		return;
	}
	client.send(JSON.stringify({ type: "error", requestId: "unknown", error }));
}
