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
} from "./types/daemon.types";
import { startWorkflowCommandWorker } from "./workflow-command-worker";

export class DaemonManager {
	constructor(private readonly options: RunProductionDaemonOptions = {}) {}

	async runProduction(): Promise<number> {
		const context = this.createContext();
		return startDaemonServices(
			{
				cwd: context.cwd,
				services: buildDaemonCommandsForPorts(
					context.env,
					context.ports,
					context.cwd,
				),
				serverHealthUrl: context.serverHealthUrl,
				webUrl: context.webUrl,
				spawnChild: context.spawnChild,
				startWorkflowWorker: () =>
					(this.options.startWorkflowWorker ?? startWorkflowCommandWorker)({
						cwd: context.cwd,
						env: {
							...context.workspaceEnv,
							DEVOS_SERVER_BASE_URL: context.serverBaseUrl,
							DEVOS_WORKFLOW_WS_URL: context.workflowWsUrl,
						},
					}),
				waitForServerReady:
					this.options.waitForServerReady ?? waitForDaemonHttpReady,
				waitForWebReady: this.options.waitForWebReady ?? waitForDaemonHttpReady,
				readinessScheduler: this.options.readinessScheduler,
				write: this.options.write,
			},
			this.options.signalTarget ?? process,
			this.options.cleanupPorts ?? cleanupDaemonPorts,
			context.ports,
		);
	}

	private createContext() {
		const cwd = this.options.cwd ?? process.cwd();
		const env = this.options.env ?? process.env;
		const ports = resolveDaemonPorts(env);
		const serverBaseUrl =
			env.DEVOS_SERVER_BASE_URL ?? `http://127.0.0.1:${ports.serverPort}`;
		return {
			cwd,
			env,
			ports,
			serverBaseUrl,
			serverHealthUrl: new URL("/health", serverBaseUrl).toString(),
			webUrl: resolveWebUrl(env),
			workflowWsUrl:
				env.DEVOS_WORKFLOW_WS_URL ?? resolveWorkflowWsUrl(serverBaseUrl),
			workspaceEnv: resolveDaemonWorkspaceEnv(env, cwd),
			spawnChild: this.options.spawnChild ?? spawnDaemonChild,
		};
	}
}

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

const spawnDaemonChild: DaemonSpawn = (command, args, options) =>
	spawn(command, args, options);
