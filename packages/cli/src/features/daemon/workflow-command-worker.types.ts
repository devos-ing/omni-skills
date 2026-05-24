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

export interface WorkflowCommandWorkerSignalTarget {
	on(signal: NodeJS.Signals, listener: () => void): void;
	off(signal: NodeJS.Signals, listener: () => void): void;
}

export interface WorkflowCommandWorkerOptions {
	cwd: string;
	computer?: WorkflowComputerRegistration;
	env?: NodeJS.ProcessEnv;
	logger?: WorkflowCommandWorkerLogger;
	reconnectDelayMs?: number;
	scheduler?: WorkflowCommandWorkerScheduler;
	WebSocketImpl?: WorkflowCommandWorkerWebSocketConstructor;
	workerId?: string;
}

export interface RunWorkflowCommandWorkerOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	signalTarget?: WorkflowCommandWorkerSignalTarget;
	startWorkflowWorker?: (
		options: WorkflowCommandWorkerOptions,
	) => WorkflowCommandWorker;
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
	computer?: WorkflowComputerRegistration;
}

export interface WorkflowWorkerDispatchFrame {
	type: "cli.dispatch";
	requestId: string;
	request: CliCommandRequest;
}

export type WorkflowCommandStreamFrame = CliCommandStreamEvent & {
	requestId: string;
};

export interface WorkflowComputerRegistration {
	id: string;
	name: string;
	hostname: string;
	platform: string;
	arch: string;
	cwd: string;
	startedAt: string;
	processId?: number;
	user?: string;
}
