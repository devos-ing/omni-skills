import { spawn } from "node:child_process";
import type { Readable } from "node:stream";
import { createDaemonProgressPrinter } from "./daemon-progress-printer";
import { resolveServerBaseUrl, resolveWorkflowWsUrl } from "./daemon-urls";
import { resolveDaemonWorkspaceEnv } from "./daemon-workspace-env";

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

export function buildWorkflowPollerInvocation() {
	return {
		command: "bun",
		args: [
			"run",
			"packages/cli/src/index.ts",
			"run",
			"--all-projects",
			"--poll-forever",
		],
	};
}

export function startAttachedWorkflowPoller(
	options: AttachedPollerOptions,
): AttachedPoller {
	const env = buildAttachedPollerEnv(options.env ?? process.env, options.cwd);
	const spawnPoller = options.spawnPoller ?? spawnAttachedPoller;
	const invocation = buildWorkflowPollerInvocation();
	const child = spawnPoller(invocation.command, invocation.args, {
		cwd: options.cwd,
		env,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const write = options.write ?? process.stdout.write.bind(process.stdout);
	const stdoutPrinter = createDaemonProgressPrinter(write);
	child.stdout?.on("data", (chunk) => stdoutPrinter.push(String(chunk)));
	child.stdout?.on("end", () => stdoutPrinter.flush());
	child.stderr?.on("data", (chunk) => write(String(chunk)));
	return child;
}

export function buildAttachedPollerEnv(
	env: NodeJS.ProcessEnv,
	cwd?: string,
): NodeJS.ProcessEnv {
	const workspaceEnv = resolveDaemonWorkspaceEnv(env, cwd);
	const serverBaseUrl = resolveServerBaseUrl(env);
	return {
		...workspaceEnv,
		DEVOS_SERVER_BASE_URL: serverBaseUrl,
		DEVOS_WORKFLOW_WS_URL:
			env.DEVOS_WORKFLOW_WS_URL ?? resolveWorkflowWsUrl(serverBaseUrl),
		DEVOS_WORKFLOW_PROGRESS_STREAM: "1",
	};
}

const spawnAttachedPoller: AttachedPollerSpawn = (command, args, options) =>
	spawn(command, args, options);
