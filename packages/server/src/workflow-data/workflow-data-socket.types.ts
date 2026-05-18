import type { IncomingMessage, Server } from "node:http";
import type { Duplex } from "node:stream";
import type { RawData } from "ws";
import type { ServerDatabase } from "../db";
import type { RealtimeEventPublisher } from "../realtime";

export interface WorkflowDataSocket {
	readyState: number;
	send(message: string): void;
	close(): void;
	on(event: "message", listener: (message: RawData) => void): this;
	on(event: "close", listener: () => void): this;
}

export interface WorkflowDataSocketOptions {
	server: Server;
	path: string;
	db: ServerDatabase["db"];
	realtimeEvents?: RealtimeEventPublisher;
}

export interface WorkflowDataSocketProxy {
	close(): Promise<void>;
}

export interface WorkflowDataWebSocketServer {
	handleUpgrade(
		request: IncomingMessage,
		socket: Duplex,
		head: Buffer,
		callback: (client: WorkflowDataSocket) => void,
	): void;
	emit(event: "connection", client: WorkflowDataSocket): boolean;
	on(event: "connection", listener: (client: WorkflowDataSocket) => void): this;
	close(callback: (error?: Error) => void): void;
}
