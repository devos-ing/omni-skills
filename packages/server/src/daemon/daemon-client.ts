import type {
	CliDaemonInboundFrame,
	CliDaemonOutboundFrame,
} from "devos/features/daemon";
import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandRequest,
	CliCommandStreamEvent,
} from "devos/features/server";
import type {
	CliDaemonClient,
	CliDaemonClientOptions,
} from "./daemon-client.types";

const DEFAULT_HISTORY_LIMIT = 100;

export function createCliDaemonClient(
	options: CliDaemonClientOptions,
): CliDaemonClient {
	const history: CliCommandExecutionHistoryEntry[] = [];
	const historyLimit = options.historyLimit ?? DEFAULT_HISTORY_LIMIT;

	return {
		getHistory: () => [...history],
		execute: (request) =>
			executeViaDaemon(options, request, history, historyLimit),
		executeStream: (request, emit) =>
			executeViaDaemon(options, request, history, historyLimit, emit),
	};
}

async function executeViaDaemon(
	options: CliDaemonClientOptions,
	request: CliCommandRequest,
	history: CliCommandExecutionHistoryEntry[],
	historyLimit: number,
	emit?: (event: CliCommandStreamEvent) => void,
): Promise<CliCommandExecutionResult> {
	const requestedAt = new Date().toISOString();
	const requestId = crypto.randomUUID();
	const socket = new (options.WebSocketImpl ?? WebSocket)(options.url);
	return new Promise((resolve, reject) => {
		let completed = false;
		socket.addEventListener("open", () => {
			socket.send(
				JSON.stringify({
					type: "command",
					requestId,
					request,
				} satisfies CliDaemonInboundFrame),
			);
		});
		socket.addEventListener("message", (event) => {
			const frame = parseOutboundFrame(String(event.data));
			if (!frame || !("requestId" in frame) || frame.requestId !== requestId) {
				return;
			}
			const streamEvent = toStreamEvent(frame);
			if (streamEvent) {
				emit?.(streamEvent);
			}
			if (frame.type !== "complete") {
				return;
			}
			completed = true;
			socket.close();
			recordHistory(history, historyLimit, requestedAt, frame.result);
			resolve(frame.result);
		});
		socket.addEventListener("error", () => {
			if (!completed) {
				reject(new Error("CLI daemon websocket connection failed"));
			}
		});
		socket.addEventListener("close", () => {
			if (!completed) {
				reject(new Error("CLI daemon websocket connection closed"));
			}
		});
	});
}

function parseOutboundFrame(input: string): CliDaemonOutboundFrame | undefined {
	try {
		return JSON.parse(input) as CliDaemonOutboundFrame;
	} catch {
		return undefined;
	}
}

function toStreamEvent(
	frame: CliDaemonOutboundFrame,
): CliCommandStreamEvent | undefined {
	if (frame.type === "start") {
		return {
			type: "start",
			request: frame.request,
			invocation: frame.invocation,
		};
	}
	if (frame.type === "stdout" || frame.type === "stderr") {
		return { type: frame.type, text: frame.text };
	}
	if (frame.type === "error") {
		return { type: "error", error: frame.error };
	}
	if (frame.type === "complete") {
		return { type: "complete", result: frame.result };
	}
	return undefined;
}

function recordHistory(
	history: CliCommandExecutionHistoryEntry[],
	historyLimit: number,
	requestedAt: string,
	result: CliCommandExecutionResult,
): void {
	history.push({
		requestedAt,
		finishedAt: new Date().toISOString(),
		request: result.request,
		status: result.status,
		command: result.invocation?.command,
		args: result.invocation?.args,
		exitCode: result.commandResult?.code,
		stdout: result.commandResult?.stdout,
		stderr: result.commandResult?.stderr,
		error: result.error,
	});
	if (history.length > historyLimit) {
		history.splice(0, history.length - historyLimit);
	}
}
