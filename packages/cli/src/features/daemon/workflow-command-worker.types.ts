import type { CliCommandRequest, CliCommandStreamEvent } from "../server";

export interface WorkflowCommandWorker {
	workerId: string;
	stop(): Promise<void>;
}

export interface WorkflowCommandWorkerSocket {
	send(message: string): void;
	close(): void;
	addEventListener(
		event: "open" | "message" | "error" | "close",
		listener: (event: { data?: unknown }) => void,
	): void;
}

export type WorkflowCommandWorkerWebSocketConstructor = new (
	url: string,
) => WorkflowCommandWorkerSocket;

export interface WorkflowCommandWorkerSchedulerHandle {
	cancel(): void;
}

export type WorkflowCommandWorkerScheduler = (
	callback: () => void,
	delayMs: number,
) => WorkflowCommandWorkerSchedulerHandle;

export interface WorkflowCommandWorkerLogger {
	info(context: Record<string, unknown>, message: string): void;
	warn(context: Record<string, unknown>, message: string): void;
	error(context: Record<string, unknown>, message: string): void;
}

export interface WorkflowCommandWorkerOptions {
	cwd: string;
	env?: NodeJS.ProcessEnv;
	logger?: WorkflowCommandWorkerLogger;
	reconnectDelayMs?: number;
	scheduler?: WorkflowCommandWorkerScheduler;
	WebSocketImpl?: WorkflowCommandWorkerWebSocketConstructor;
	workerId?: string;
}

export interface WorkflowPingFrame {
	type: "ping";
	requestId: string;
}

export interface WorkflowPongFrame {
	type: "pong";
	requestId: string;
}

export interface WorkflowWorkerReadyFrame {
	type: "cli.worker.ready";
	workerId: string;
}

export interface WorkflowWorkerDispatchFrame {
	type: "cli.dispatch";
	requestId: string;
	request: CliCommandRequest;
}

export type WorkflowCommandStreamFrame = CliCommandStreamEvent & {
	requestId: string;
};
