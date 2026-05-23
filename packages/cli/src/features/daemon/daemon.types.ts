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

export interface DaemonPortCleanupPorts {
	serverPort: string;
	webPort: string;
}

export type DaemonPortCleanup = (
	ports: DaemonPortCleanupPorts,
) => Promise<void>;

export type DaemonPortCleanupRunCommand = (
	command: string,
	args: string[],
) => Promise<string>;

export type DaemonPortCleanupSleep = (ms: number) => Promise<void>;

export interface DaemonPortCleanupOptions {
	runCommand?: DaemonPortCleanupRunCommand;
	killProcess?: (pid: number, signal: NodeJS.Signals) => void;
	sleep?: DaemonPortCleanupSleep;
}

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

export type DaemonReadinessShouldStop = () => boolean;

export type DaemonServiceReadinessProbe = (
	url: string,
	shouldStop?: DaemonReadinessShouldStop,
) => Promise<void>;

export type DaemonReadinessFetch = (url: string) => Promise<{ ok: boolean }>;

export type DaemonReadinessSleep = (ms: number) => Promise<void>;

export interface DaemonHttpReadinessOptions {
	fetch?: DaemonReadinessFetch;
	intervalMs?: number;
	shouldStop?: DaemonReadinessShouldStop;
	sleep?: DaemonReadinessSleep;
	timeoutMs?: number;
}

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
	cleanupPorts?: DaemonPortCleanup;
	spawnChild?: DaemonSpawn;
	signalTarget?: DaemonSignalTarget;
	startWorkflowWorker?: (options: {
		cwd: string;
		env?: NodeJS.ProcessEnv;
	}) => WorkflowCommandWorker;
	waitForServerReady?: DaemonServiceReadinessProbe;
	waitForWebReady?: DaemonServiceReadinessProbe;
	write?: (message: string) => void;
}

export interface DaemonStartupInput {
	cwd: string;
	readinessScheduler?: RunProductionDaemonOptions["readinessScheduler"];
	serverHealthUrl: string;
	services: DaemonServiceCommand[];
	spawnChild: DaemonSpawn;
	waitForServerReady: NonNullable<
		RunProductionDaemonOptions["waitForServerReady"]
	>;
	waitForWebReady: NonNullable<RunProductionDaemonOptions["waitForWebReady"]>;
	webUrl: string;
	write?: (message: string) => void;
}
