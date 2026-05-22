import { spawn } from "node:child_process";
import { buildWorkflowPollerInvocation } from "./daemon-poller";
import { resolveDaemonPorts } from "./daemon-ports";
import { scheduleDaemonReadyMessage } from "./daemon-readiness";
import { resolveServerBaseUrl, resolveWorkflowWsUrl } from "./daemon-urls";
import { resolveDaemonWorkspaceEnv } from "./daemon-workspace-env";
import type {
	DaemonChild,
	DaemonReadinessHandle,
	DaemonServiceCommand,
	DaemonSignalTarget,
	DaemonSpawn,
	RunProductionDaemonOptions,
} from "./daemon.types";
import { startWorkflowCommandWorker } from "./workflow-command-worker";

const SIGNALS = ["SIGINT", "SIGTERM"] as const;

export function buildDaemonCommands(
	env: NodeJS.ProcessEnv = process.env,
	cwd?: string,
): DaemonServiceCommand[] {
	const { serverPort, webPort } = resolveDaemonPorts(env);
	const serverBaseUrl = resolveServerBaseUrl(env);
	const workflowWsUrl =
		env.DEVOS_WORKFLOW_WS_URL ?? resolveWorkflowWsUrl(serverBaseUrl);
	const baseEnv = {
		...resolveDaemonWorkspaceEnv(env, cwd),
		NODE_ENV: "production",
	};
	const pollerInvocation = buildWorkflowPollerInvocation();

	return [
		{
			name: "server",
			command: "bun",
			args: ["run", "--filter", "devos-server", "start"],
			env: {
				...baseEnv,
				PIV_SERVER_PORT: serverPort,
			},
		},
		{
			name: "web",
			command: "bun",
			args: ["run", "--filter", "web", "start"],
			env: {
				...baseEnv,
				PORT: webPort,
				DEVOS_SERVER_BASE_URL: serverBaseUrl,
				NEXT_PUBLIC_DEVOS_WORKFLOW_WS_URL: workflowWsUrl,
			},
		},
		{
			name: "workflow-poller",
			command: pollerInvocation.command,
			args: pollerInvocation.args,
			env: {
				...baseEnv,
				DEVOS_SERVER_BASE_URL: serverBaseUrl,
				DEVOS_WORKFLOW_WS_URL: workflowWsUrl,
			},
		},
	];
}

export async function runProductionDaemon(
	options: RunProductionDaemonOptions = {},
): Promise<number> {
	const cwd = options.cwd ?? process.cwd();
	const spawnChild = options.spawnChild ?? spawnDaemonChild;
	const signalTarget = options.signalTarget ?? process;
	const env = options.env ?? process.env;
	const serverBaseUrl = resolveServerBaseUrl(env);
	const workspaceEnv = resolveDaemonWorkspaceEnv(env, cwd);
	const services = buildDaemonCommands(env, cwd);
	const workflowWorker = (
		options.startWorkflowWorker ?? startWorkflowCommandWorker
	)({
		cwd,
		env: {
			...workspaceEnv,
			DEVOS_SERVER_BASE_URL: serverBaseUrl,
			DEVOS_WORKFLOW_WS_URL:
				env.DEVOS_WORKFLOW_WS_URL ?? resolveWorkflowWsUrl(serverBaseUrl),
		},
	});
	const children = services.map((service) =>
		spawnChild(service.command, service.args, {
			cwd,
			env: service.env,
			stdio: "inherit",
		}),
	);
	const ready = scheduleDaemonReadyMessage({
		scheduler: options.readinessScheduler,
		write: options.write,
	});

	return superviseDaemonChildren(children, signalTarget, workflowWorker, ready);
}

function superviseDaemonChildren(
	children: DaemonChild[],
	signalTarget: DaemonSignalTarget,
	workflowWorker: { stop(): Promise<void> },
	readiness?: DaemonReadinessHandle,
): Promise<number> {
	return new Promise((resolve) => {
		let resolved = false;
		let isShuttingDown = false;

		const finish = (code: number) => {
			if (resolved) {
				return;
			}
			resolved = true;
			readiness?.cancel();
			for (const signal of SIGNALS) {
				signalTarget.off(signal, signalHandlers[signal]);
			}
			void workflowWorker.stop();
			resolve(code);
		};

		const shutdown = (
			signal: NodeJS.Signals = "SIGTERM",
			excludedChild?: DaemonChild,
		) => {
			if (isShuttingDown) {
				return;
			}
			isShuttingDown = true;
			for (const child of children) {
				if (child !== excludedChild && !child.killed) {
					child.kill(signal);
				}
			}
		};

		const signalHandlers = {
			SIGINT: () => {
				shutdown("SIGINT");
				finish(0);
			},
			SIGTERM: () => {
				shutdown("SIGTERM");
				finish(0);
			},
		};

		for (const signal of SIGNALS) {
			signalTarget.on(signal, signalHandlers[signal]);
		}

		for (const child of children) {
			child.on("error", () => {
				shutdown("SIGTERM", child);
				finish(1);
			});
			child.on("close", (code, signal) => {
				if (resolved) {
					return;
				}
				shutdown(signal ?? undefined, child);
				finish(code ?? (signal ? 1 : 0));
			});
		}
	});
}

const spawnDaemonChild: DaemonSpawn = (command, args, options) =>
	spawn(command, args, options);
