import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { ServerDatabase } from "devos-db";
import type { RawData } from "ws";
import type { RealtimeEventPublisher } from "../realtime";

export interface DaemonEventsSocket {
	readyState: number;
	send(message: string): void;
	close(): void;
	on(event: "message", listener: (message: RawData) => void): this;
	on(event: "close", listener: () => void): this;
}

export interface DaemonEventsProxyOptions {
	server: Server;
	path: string;
	db: ServerDatabase["db"];
	realtimeEvents: RealtimeEventPublisher;
}

export interface DaemonEventsProxy {
	close(): Promise<void>;
}

export interface DaemonEventsWebSocketServer {
	handleUpgrade(
		request: IncomingMessage,
		socket: Duplex,
		head: Buffer,
		callback: (client: DaemonEventsSocket) => void,
	): void;
	emit(event: "connection", client: DaemonEventsSocket): boolean;
	on(event: "connection", listener: (client: DaemonEventsSocket) => void): this;
	close(callback: (error?: Error) => void): void;
}
