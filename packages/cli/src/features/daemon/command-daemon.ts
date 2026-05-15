import { CliCommandExecutor } from "../server";
import type { CliCommandStreamEvent } from "../server";
import {
	parseCliDaemonInboundFrame,
	serializeCliDaemonFrame,
} from "./command-daemon-protocol";
import type {
	CliCommandDaemon,
	CliCommandDaemonOptions,
	CliDaemonOutboundFrame,
} from "./command-daemon.types";

export const DEFAULT_CLI_DAEMON_PORT = 3002;

export function resolveCliDaemonPort(env: NodeJS.ProcessEnv): number {
	const rawPort = env.DEVOS_CLI_DAEMON_PORT;
	if (!rawPort) {
		return DEFAULT_CLI_DAEMON_PORT;
	}
	const port = Number(rawPort);
	if (!Number.isInteger(port) || port <= 0) {
		throw new Error("CLI daemon port must be a positive integer");
	}
	return port;
}

export function formatCliDaemonWsUrl(port: number): string {
	return `ws://127.0.0.1:${port}`;
}

export function startCliCommandDaemon(
	options: CliCommandDaemonOptions,
): CliCommandDaemon {
	const port = options.port ?? resolveCliDaemonPort(options.env ?? process.env);
	const executor = new CliCommandExecutor({
		cwd: options.cwd,
		command: "bun",
		baseArgs: ["run", "./packages/cli/src/index.ts"],
		env: options.env,
	});
	const server = Bun.serve<{ connectedAt: string }>({
		port,
		fetch(request, bunServer) {
			if (
				bunServer.upgrade(request, {
					data: { connectedAt: new Date().toISOString() },
				})
			) {
				return undefined;
			}
			return new Response("CLI daemon websocket endpoint", { status: 426 });
		},
		websocket: {
			open(socket) {
				sendFrame(socket, { type: "ready" });
			},
			message(socket, message) {
				const parsed = parseCliDaemonInboundFrame(String(message));
				if (parsed.status === "error") {
					sendFrame(socket, {
						type: "error",
						requestId: "unknown",
						error: parsed.error,
					});
					return;
				}
				if (parsed.frame.type === "ping") {
					sendFrame(socket, {
						type: "pong",
						requestId: parsed.frame.requestId,
					});
					return;
				}
				void executor.executeStream(parsed.frame.request, (event) => {
					sendFrame(socket, toOutboundFrame(parsed.frame.requestId, event));
				});
			},
		},
	});
	return {
		port,
		stop: () => Promise.resolve(server.stop(true)),
	};
}

function sendFrame(
	socket: Bun.ServerWebSocket<{ connectedAt: string }>,
	frame: CliDaemonOutboundFrame,
): void {
	try {
		socket.send(serializeCliDaemonFrame(frame));
	} catch {
		// Browser disconnects stop live streaming only; the command keeps running.
	}
}

function toOutboundFrame(
	requestId: string,
	event: CliCommandStreamEvent,
): CliDaemonOutboundFrame {
	if (event.type === "start") {
		return { ...event, requestId };
	}
	if (event.type === "stdout" || event.type === "stderr") {
		return { ...event, requestId };
	}
	if (event.type === "error") {
		return { ...event, requestId };
	}
	return { ...event, requestId };
}
