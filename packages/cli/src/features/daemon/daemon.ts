import { spawn } from "node:child_process";
import { buildWorkflowPollerInvocation } from "./daemon-poller";
import { cleanupDaemonPorts } from "./daemon-port-cleanup";
import { resolveDaemonPorts } from "./daemon-ports";
import { waitForDaemonHttpReady } from "./daemon-service-readiness";
import { startDaemonServices } from "./daemon-service-supervisor";
import { resolveWebUrl, resolveWorkflowWsUrl } from "./daemon-urls";
import { resolveDaemonWorkspaceEnv } from "./daemon-workspace-env";
import type {
	DaemonPortCleanupPorts,
	DaemonServiceCommand,
	DaemonSpawn,
	RunProductionDaemonOptions,
} from "./daemon.types";
import { startWorkflowCommandWorker } from "./workflow-command-worker";

export function buildDaemonCommands(
	env: NodeJS.ProcessEnv = process.env,
	cwd?: string,
): DaemonServiceCommand[] {
	return buildDaemonCommandsForPorts(env, resolveDaemonPorts(env), cwd);
}

function buildDaemonCommandsForPorts(
	env: NodeJS.ProcessEnv,
	ports: DaemonPortCleanupPorts,
	cwd?: string,
): DaemonServiceCommand[] {
	const serverBaseUrl =
		env.DEVOS_SERVER_BASE_URL ?? `http://127.0.0.1:${ports.serverPort}`;
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
				PIV_SERVER_PORT: ports.serverPort,
			},
		},
		{
			name: "web",
			command: "bun",
			args: ["run", "--filter", "web", "start"],
			env: {
				...baseEnv,
				PORT: ports.webPort,
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
	const ports = resolveDaemonPorts(env);
	const serverBaseUrl =
		env.DEVOS_SERVER_BASE_URL ?? `http://127.0.0.1:${ports.serverPort}`;
	const serverHealthUrl = new URL("/health", serverBaseUrl).toString();
	const webUrl = resolveWebUrl(env);
	const workspaceEnv = resolveDaemonWorkspaceEnv(env, cwd);
	const services = buildDaemonCommandsForPorts(env, ports, cwd);
	const cleanupPorts = options.cleanupPorts ?? cleanupDaemonPorts;
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
	return startDaemonServices(
		{
			cwd,
			services,
			serverHealthUrl,
			webUrl,
			spawnChild,
			waitForServerReady: options.waitForServerReady ?? waitForDaemonHttpReady,
			waitForWebReady: options.waitForWebReady ?? waitForDaemonHttpReady,
			readinessScheduler: options.readinessScheduler,
			write: options.write,
		},
		signalTarget,
		workflowWorker,
		cleanupPorts,
		ports,
	);
}

const spawnDaemonChild: DaemonSpawn = (command, args, options) =>
	spawn(command, args, options);
