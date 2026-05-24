import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandRequest,
	CliCommandStreamEmit,
} from "devos/features/server";
import { WebSocket } from "ws";
import type { WorkflowCommandBroker } from "./workflow-command-broker.types";
import type { WorkflowDataSocket } from "./workflow-data-socket.types";
import type {
	WorkflowCliCommandExecutionResult,
	WorkflowCliCommandRequest,
	WorkflowClientCommandFrame,
	WorkflowCommandStreamFrame,
	WorkflowWorkerDispatchFrame,
} from "./workflow-data.types";
import type {
	WorkflowComputerRegistration,
	RegisteredWorkflowComputer,
} from "./workflow-computer.types";

const DEFAULT_HISTORY_LIMIT = 100;
const NO_WORKER_ERROR = "No CLI worker connected to /api/workflow";

interface ActiveWorker {
	computerId?: string;
	socket: WorkflowDataSocket;
	workerId: string;
}

interface PendingCommand {
	emit: (frame: WorkflowCommandStreamFrame) => void;
	request: CliCommandRequest;
	requestedAt: string;
	resolve(result: CliCommandExecutionResult): void;
}

export function createWorkflowCommandBroker(
	historyLimit = DEFAULT_HISTORY_LIMIT,
): WorkflowCommandBroker {
	const history: CliCommandExecutionHistoryEntry[] = [];
	const computers = new Map<string, RegisteredWorkflowComputer>();
	const pending = new Map<string, PendingCommand>();
	let activeWorker: ActiveWorker | undefined;

	const broker: WorkflowCommandBroker = {
		dispatchCommand: (frame, emit) =>
			dispatch(frame.requestId, frame.request as CliCommandRequest, emit),
		execute: (request) => dispatch(crypto.randomUUID(), request),
		executeStream: (request, emit) =>
			dispatch(crypto.randomUUID(), request, (frame) =>
				emit(toCommandStreamEvent(frame)),
			),
		getHistory: () => [...history],
		listComputers: () =>
			[...computers.values()].sort((left, right) =>
				left.name.localeCompare(right.name),
			),
		handleWorkerFrame(frame) {
			touchActiveComputer();
			const command = pending.get(frame.requestId);
			if (!command) {
				return;
			}
			command.emit(frame);
			if (frame.type === "complete") {
				pending.delete(frame.requestId);
				const result = frame.result as CliCommandExecutionResult;
				recordHistory(history, historyLimit, command.requestedAt, result);
				command.resolve(result);
			}
		},
		registerWorker(socket, workerId, computer) {
			if (activeWorker && activeWorker.socket !== socket) {
				failPending("CLI worker replaced");
				markComputerOffline(activeWorker.computerId);
				activeWorker.socket.close();
			}
			const computerId = registerComputer(workerId, computer);
			activeWorker = {
				socket,
				workerId,
				...(computerId ? { computerId } : {}),
			};
			socket.on("close", () => {
				if (activeWorker?.socket === socket) {
					activeWorker = undefined;
					markComputerOffline(computerId);
					failPending(`CLI worker disconnected: ${workerId}`);
				}
			});
		},
	};

	function dispatch(
		requestId: string,
		request: CliCommandRequest,
		emit: (frame: WorkflowCommandStreamFrame) => void = () => {},
	): Promise<CliCommandExecutionResult> {
		const requestedAt = new Date().toISOString();
		const worker = activeWorker;
		if (!worker || worker.socket.readyState !== WebSocket.OPEN) {
			const result = failedResult(request, NO_WORKER_ERROR);
			emit({ type: "error", requestId, error: NO_WORKER_ERROR });
			emit({
				type: "complete",
				requestId,
				result: result as WorkflowCliCommandExecutionResult,
			});
			recordHistory(history, historyLimit, requestedAt, result);
			return Promise.resolve(result);
		}
		return new Promise((resolve) => {
			pending.set(requestId, { emit, request, requestedAt, resolve });
			worker.socket.send(
				JSON.stringify({
					type: "cli.dispatch",
					requestId,
					request: request as WorkflowCliCommandRequest,
				} satisfies WorkflowWorkerDispatchFrame),
			);
		});
	}

	function failPending(error: string): void {
		for (const [requestId, command] of pending) {
			const result = failedResult(command.request, error);
			command.emit({ type: "error", requestId, error });
			command.emit({
				type: "complete",
				requestId,
				result: result as WorkflowCliCommandExecutionResult,
			});
			recordHistory(history, historyLimit, command.requestedAt, result);
			command.resolve(result);
		}
		pending.clear();
	}

	function registerComputer(
		workerId: string,
		computer: WorkflowComputerRegistration | undefined,
	): string | undefined {
		if (!computer) {
			return undefined;
		}
		const now = new Date().toISOString();
		computers.set(computer.id, {
			...computer,
			workerId,
			status: "online",
			connectedAt: now,
			lastSeenAt: now,
		});
		return computer.id;
	}

	function touchActiveComputer(): void {
		const computerId = activeWorker?.computerId;
		if (!computerId) {
			return;
		}
		const computer = computers.get(computerId);
		if (!computer) {
			return;
		}
		computers.set(computerId, {
			...computer,
			lastSeenAt: new Date().toISOString(),
		});
	}

	function markComputerOffline(computerId: string | undefined): void {
		if (!computerId) {
			return;
		}
		const computer = computers.get(computerId);
		if (!computer) {
			return;
		}
		const now = new Date().toISOString();
		computers.set(computerId, {
			...computer,
			status: "offline",
			lastSeenAt: now,
			disconnectedAt: now,
		});
	}

	return broker;
}

function failedResult(
	request: CliCommandRequest,
	error: string,
): CliCommandExecutionResult {
	return { status: "failed", request, error };
}

function toCommandStreamEvent(
	frame: WorkflowCommandStreamFrame,
): Parameters<CliCommandStreamEmit>[0] {
	const { requestId: _requestId, ...event } = frame;
	return event as Parameters<CliCommandStreamEmit>[0];
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
