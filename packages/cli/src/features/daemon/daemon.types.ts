import type { WorkflowCommandWorker } from "./workflow-command-worker.types";

export type DaemonServiceName = "server" | "web" | "workflow-poller";

export interface DaemonServiceCommand {
	name: DaemonServiceName;
	command: string;
	args: string[];
	env: NodeJS.ProcessEnv;
}

export interface DaemonChild {
	killed: boolean;
	kill(signal?: NodeJS.Signals): boolean;
	on(event: "close", listener: DaemonChildCloseListener): this;
	on(event: "error", listener: DaemonChildErrorListener): this;
}

export type DaemonChildCloseListener = (
	code: number | null,
	signal: NodeJS.Signals | null,
) => void;

export type DaemonChildErrorListener = (error: Error) => void;

export interface DaemonSpawnOptions {
	cwd: string;
	env: NodeJS.ProcessEnv;
	stdio: "inherit";
}

export type DaemonSpawn = (
	command: string,
	args: string[],
	options: DaemonSpawnOptions,
) => DaemonChild;

export interface DaemonSignalTarget {
	on(signal: NodeJS.Signals, listener: () => void): void;
	off(signal: NodeJS.Signals, listener: () => void): void;
}

export interface DaemonReadinessHandle {
	cancel(): void;
}

export type DaemonReadinessScheduler = (
	callback: () => void,
	delayMs: number,
) => DaemonReadinessHandle;

export interface DaemonReadinessOptions {
	delayMs?: number;
	message?: string;
	scheduler?: DaemonReadinessScheduler;
	write?: (message: string) => void;
}

export interface RunProductionDaemonOptions {
	cwd?: string;
	env?: NodeJS.ProcessEnv;
	readinessScheduler?: DaemonReadinessScheduler;
	spawnChild?: DaemonSpawn;
	signalTarget?: DaemonSignalTarget;
	startWorkflowWorker?: (options: {
		cwd: string;
		env?: NodeJS.ProcessEnv;
	}) => WorkflowCommandWorker;
	write?: (message: string) => void;
}
