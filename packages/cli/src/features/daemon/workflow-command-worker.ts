import { logger as defaultLogger } from "../../utils/logger";
import { CliCommandExecutor } from "../server";
import type {
	CliCommandExecutorOptions,
	CliCommandRequest,
	CliCommandStreamEvent,
} from "../server";
import { resolveWorkflowWorkerUrl } from "./daemon-urls";
import { buildWorkflowComputerRegistration } from "./workflow-computer-registration";
import {
	logWorkerActionReceived,
	logWorkerStreamEvent,
} from "./workflow-command-worker-logging";
import type {
	RunWorkflowCommandWorkerOptions,
	WorkflowCommandStreamFrame,
	WorkflowCommandWorker,
	WorkflowCommandWorkerLogger,
	WorkflowCommandWorkerOptions,
	WorkflowCommandWorkerScheduler,
	WorkflowCommandWorkerSocket,
	WorkflowCommandWorkerWebSocketConstructor,
	WorkflowPingFrame,
	WorkflowPongFrame,
	WorkflowWorkerDispatchFrame,
	WorkflowWorkerReadyFrame,
} from "./workflow-command-worker.types";

const DEFAULT_RECONNECT_DELAY_MS = 1000;

export function startWorkflowCommandWorker(
	options: WorkflowCommandWorkerOptions,
): WorkflowCommandWorker {
	const workerId = options.workerId ?? crypto.randomUUID();
	const computer = options.computer ?? buildWorkflowComputerRegistration(options);
	const workerLogger = options.logger ?? defaultLogger;
	const executor = new CliCommandExecutor(
		buildWorkflowCommandWorkerExecutorOptions(options),
	);
	const WebSocketImpl = resolveWebSocketImpl(options.WebSocketImpl);
	const url = resolveWorkflowWorkerUrl(options.env ?? process.env);
	const scheduler = options.scheduler ?? defaultScheduler;
	const reconnectDelayMs =
		options.reconnectDelayMs ?? DEFAULT_RECONNECT_DELAY_MS;
	let stopped = false;
	let socket: WorkflowCommandWorkerSocket | undefined;
	let reconnect: { cancel(): void } | undefined;

	const connect = () => {
		if (stopped) {
			return;
		}
		reconnect = undefined;
		socket = new WebSocketImpl(url);
		socket.addEventListener("open", () => {
			sendFrame(socket, {
				type: "cli.worker.ready",
				workerId,
				computer,
			} satisfies WorkflowWorkerReadyFrame);
		});
		socket.addEventListener("message", (event) => {
			void handleWorkerMessage(
				String(event.data),
				socket,
				executor,
				workerLogger,
			);
		});
		socket.addEventListener("error", () => scheduleReconnect());
		socket.addEventListener("close", () => scheduleReconnect());
	};

	const scheduleReconnect = () => {
		if (stopped || reconnect) {
			return;
		}
		reconnect = scheduler(connect, reconnectDelayMs);
	};

	connect();
	return {
		workerId,
		stop: async () => {
			stopped = true;
			reconnect?.cancel();
			socket?.close();
		},
	};
}

export function runWorkflowCommandWorker(
	options: RunWorkflowCommandWorkerOptions = {},
): Promise<number> {
	const worker = (options.startWorkflowWorker ?? startWorkflowCommandWorker)({
		cwd: options.cwd ?? process.cwd(),
		env: options.env ?? process.env,
	});
	const signalTarget = options.signalTarget ?? process;
	return new Promise((resolve) => {
		let resolved = false;
		const finish = () => {
			if (resolved) {
				return;
			}
			resolved = true;
			signalTarget.off("SIGINT", finish);
			signalTarget.off("SIGTERM", finish);
			void worker.stop().finally(() => resolve(0));
		};
		signalTarget.on("SIGINT", finish);
		signalTarget.on("SIGTERM", finish);
	});
}

export function buildWorkflowCommandWorkerExecutorOptions(
	options: Pick<WorkflowCommandWorkerOptions, "cwd" | "env">,
): CliCommandExecutorOptions {
	return {
		cwd: options.cwd,
		command: "bun",
		baseArgs: ["run", "packages/cli/src/index.ts"],
		env: { ...options.env, DEVOS_WORKFLOW_PROGRESS_STREAM: "1" },
	};
}

export async function handleWorkerMessage(
	input: string,
	socket: WorkflowCommandWorkerSocket | undefined,
	executor: Pick<CliCommandExecutor, "executeStream">,
	workerLogger: WorkflowCommandWorkerLogger = defaultLogger,
): Promise<void> {
	const frame = parseWorkerInboundFrame(input);
	if (!frame) {
		workerLogger.warn({}, "Malformed workflow worker frame");
		return;
	}
	if (frame.type === "ping") {
		sendFrame(socket, { type: "pong", requestId: frame.requestId });
		return;
	}
	logWorkerActionReceived(workerLogger, frame.requestId, frame.request);
	await executor.executeStream(frame.request, (event) => {
		logWorkerStreamEvent(workerLogger, frame.requestId, frame.request, event);
		sendFrame(socket, toCommandStreamFrame(frame.requestId, event));
	});
}

export function parseWorkerInboundFrame(
	input: string,
): WorkflowWorkerDispatchFrame | WorkflowPingFrame | undefined {
	let value: unknown;
	try {
		value = JSON.parse(input);
	} catch {
		return undefined;
	}
	if (!isRecord(value) || typeof value.type !== "string") {
		return undefined;
	}
	if (value.type === "ping" && isNonEmptyString(value.requestId)) {
		return { type: "ping", requestId: value.requestId };
	}
	if (
		value.type === "cli.dispatch" &&
		isNonEmptyString(value.requestId) &&
		isRecord(value.request) &&
		isNonEmptyString(value.request.action)
	) {
		return {
			type: "cli.dispatch",
			requestId: value.requestId,
			request: value.request as CliCommandRequest,
		};
	}
	return undefined;
}

function toCommandStreamFrame(
	requestId: string,
	event: CliCommandStreamEvent,
): WorkflowCommandStreamFrame {
	return { ...event, requestId };
}

function sendFrame(
	socket: WorkflowCommandWorkerSocket | undefined,
	frame:
		| WorkflowCommandStreamFrame
		| WorkflowPongFrame
		| WorkflowWorkerReadyFrame,
): void {
	try {
		socket?.send(JSON.stringify(frame));
	} catch {
		// Dropped command streams are surfaced by the server-side broker close path.
	}
}

function resolveWebSocketImpl(
	WebSocketImpl: WorkflowCommandWorkerWebSocketConstructor | undefined,
): WorkflowCommandWorkerWebSocketConstructor {
	const resolved =
		WebSocketImpl ??
		(globalThis.WebSocket as unknown as
			| WorkflowCommandWorkerWebSocketConstructor
			| undefined);
	if (!resolved) {
		throw new Error("Workflow command worker websocket is unavailable");
	}
	return resolved;
}

function defaultScheduler(
	callback: () => void,
	delayMs: number,
): ReturnType<WorkflowCommandWorkerScheduler> {
	const timeout = setTimeout(callback, delayMs);
	return { cancel: () => clearTimeout(timeout) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}
