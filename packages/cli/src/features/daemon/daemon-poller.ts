import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { createDaemonProgressPrinter } from "./daemon-progress-printer";

interface SignalTarget {
	on(signal: NodeJS.Signals, listener: () => void): void;
	off(signal: NodeJS.Signals, listener: () => void): void;
}

export interface AttachedPoller {
	killed: boolean;
	kill(signal?: NodeJS.Signals): boolean;
	on(event: "close", listener: AttachedPollerCloseListener): this;
	on(event: "error", listener: AttachedPollerErrorListener): this;
	stdout?: Readable | null;
	stderr?: Readable | null;
}

export type AttachedPollerCloseListener = (
	code: number | null,
	signal: NodeJS.Signals | null,
) => void;

export type AttachedPollerErrorListener = (error: Error) => void;

export interface AttachedPollerOptions {
	cwd: string;
	env?: NodeJS.ProcessEnv;
	write?: (message: string) => void;
	spawnPoller?: AttachedPollerSpawn;
}

export interface AttachedPollerSpawnOptions {
	cwd: string;
	env: NodeJS.ProcessEnv;
	stdio: ["ignore", "pipe", "pipe"];
}

export type AttachedPollerSpawn = (
	command: string,
	args: string[],
	options: AttachedPollerSpawnOptions,
) => AttachedPoller;

export function startAttachedWorkflowPoller(
	options: AttachedPollerOptions,
): AttachedPoller {
	const env = buildAttachedPollerEnv(options.env ?? process.env);
	const spawnPoller = options.spawnPoller ?? spawnAttachedPoller;
	const child = spawnPoller(
		"npx",
		["devos", "run", "--all-projects", "--poll-forever"],
		{
			cwd: options.cwd,
			env,
			stdio: ["ignore", "pipe", "pipe"],
		},
	);
	const write = options.write ?? process.stdout.write.bind(process.stdout);
	const stdoutPrinter = createDaemonProgressPrinter(write);
	child.stdout?.on("data", (chunk) => stdoutPrinter.push(String(chunk)));
	child.stdout?.on("end", () => stdoutPrinter.flush());
	child.stderr?.on("data", (chunk) => write(String(chunk)));
	return child;
}

export function superviseCliCommandDaemonWithPoller(
	commandDaemon: { stop(): Promise<void> },
	signalTarget: SignalTarget,
	poller?: AttachedPoller,
): Promise<number> {
	return new Promise((resolve) => {
		let resolved = false;

		const finish = (code: number, signal?: NodeJS.Signals) => {
			if (resolved) {
				return;
			}
			resolved = true;
			for (const item of SIGNALS) {
				signalTarget.off(item, signalHandlers[item]);
			}
			if (poller && !poller.killed) {
				poller.kill(signal ?? "SIGTERM");
			}
			void commandDaemon.stop().finally(() => resolve(code));
		};

		const signalHandlers = {
			SIGINT: () => finish(0, "SIGINT"),
			SIGTERM: () => finish(0, "SIGTERM"),
		};

		for (const signal of SIGNALS) {
			signalTarget.on(signal, signalHandlers[signal]);
		}

		poller?.on("error", () => finish(1));
		poller?.on("close", (code, signal) => {
			finish(code ?? (signal ? 1 : 0));
		});
	});
}

export function buildAttachedPollerEnv(
	env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
	const serverBaseUrl = env.DEVOS_SERVER_BASE_URL ?? "http://127.0.0.1:3001";
	return {
		...env,
		DEVOS_SERVER_BASE_URL: serverBaseUrl,
		DEVOS_SERVER_EVENTS_WS_URL:
			env.DEVOS_SERVER_EVENTS_WS_URL ?? resolveServerEventsWsUrl(serverBaseUrl),
		DEVOS_WORKFLOW_WS_URL:
			env.DEVOS_WORKFLOW_WS_URL ?? resolveWorkflowWsUrl(serverBaseUrl),
		DEVOS_WORKFLOW_PROGRESS_STREAM: "1",
	};
}

function resolveServerEventsWsUrl(serverBaseUrl: string): string {
	const url = new URL("/daemon/events", serverBaseUrl);
	if (url.protocol === "http:") {
		url.protocol = "ws:";
	}
	if (url.protocol === "https:") {
		url.protocol = "wss:";
	}
	return url.toString();
}

function resolveWorkflowWsUrl(serverBaseUrl: string): string {
	const url = new URL("/api/workflow", serverBaseUrl);
	if (url.protocol === "http:") {
		url.protocol = "ws:";
	}
	if (url.protocol === "https:") {
		url.protocol = "wss:";
	}
	return url.toString();
}

const spawnAttachedPoller: AttachedPollerSpawn = (command, args, options) =>
	spawn(command, args, options);

const SIGNALS = ["SIGINT", "SIGTERM"] as const;
