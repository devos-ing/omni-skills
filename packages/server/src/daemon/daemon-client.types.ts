import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
	CliCommandRequest,
	CliCommandStreamEmit,
} from "devos/features/server";

export interface CliDaemonClientOptions {
	url: string;
	historyLimit?: number;
	WebSocketImpl?: typeof WebSocket;
}

export interface CliDaemonClient {
	execute(request: CliCommandRequest): Promise<CliCommandExecutionResult>;
	executeStream(
		request: CliCommandRequest,
		emit: CliCommandStreamEmit,
	): Promise<CliCommandExecutionResult>;
	getHistory(): CliCommandExecutionHistoryEntry[];
}

export interface CliDaemonDispatchSession {
	requestId: string;
	socket: WebSocket;
	done: Promise<CliCommandExecutionResult>;
}
