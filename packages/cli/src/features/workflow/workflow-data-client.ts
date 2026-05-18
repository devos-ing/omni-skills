import {
	WORKFLOW_DATA_WS_PATH,
	type WorkflowDataAction,
	type WorkflowDataRequestFrame,
	type WorkflowDataResponseFrame,
} from "devos-server/workflow-data";

const DEFAULT_SERVER_BASE_URL = "http://127.0.0.1:3001";
const REQUEST_TIMEOUT_MS = 5000;

export interface WorkflowDataWebSocket {
	send(message: string): void;
	close(): void;
	addEventListener(
		event: "open" | "message" | "error" | "close",
		listener: (event: { data?: unknown }) => void,
	): void;
}

export type WorkflowDataWebSocketConstructor = new (
	url: string,
) => WorkflowDataWebSocket;

export interface WorkflowDataClientOptions {
	env?: NodeJS.ProcessEnv;
	WebSocketImpl?: WorkflowDataWebSocketConstructor;
	timeoutMs?: number;
}

export function createWorkflowDataClient(
	options: WorkflowDataClientOptions = {},
) {
	const env = options.env ?? process.env;
	const url = resolveWorkflowDataWsUrl(env);
	const WebSocketImpl =
		options.WebSocketImpl ??
		(globalThis.WebSocket as unknown as
			| WorkflowDataWebSocketConstructor
			| undefined);
	if (!WebSocketImpl) {
		throw new Error("Workflow websocket is unavailable in this runtime");
	}
	return {
		request<T>(action: WorkflowDataAction, payload?: unknown): Promise<T> {
			return requestWorkflowData<T>(
				url,
				WebSocketImpl,
				action,
				payload,
				options.timeoutMs,
			);
		},
	};
}

export function resolveWorkflowDataWsUrl(env: NodeJS.ProcessEnv): string {
	if (env.DEVOS_WORKFLOW_WS_URL) {
		return env.DEVOS_WORKFLOW_WS_URL;
	}
	const baseUrl = env.DEVOS_SERVER_BASE_URL ?? DEFAULT_SERVER_BASE_URL;
	const url = new URL(WORKFLOW_DATA_WS_PATH, baseUrl);
	if (url.protocol === "http:") {
		url.protocol = "ws:";
	}
	if (url.protocol === "https:") {
		url.protocol = "wss:";
	}
	return url.toString();
}

function requestWorkflowData<T>(
	url: string,
	WebSocketImpl: WorkflowDataWebSocketConstructor,
	action: WorkflowDataAction,
	payload: unknown,
	timeoutMs = REQUEST_TIMEOUT_MS,
): Promise<T> {
	return new Promise((resolve, reject) => {
		const requestId = crypto.randomUUID();
		const socket = new WebSocketImpl(url);
		let settled = false;
		const timeout = setTimeout(() => {
			finish(() =>
				reject(workflowConnectionError(`Workflow websocket timed out: ${url}`)),
			);
		}, timeoutMs);
		const finish = (callback: () => void) => {
			if (settled) {
				return;
			}
			settled = true;
			clearTimeout(timeout);
			try {
				socket.close();
			} catch {}
			callback();
		};
		socket.addEventListener("open", () => {
			const frame: WorkflowDataRequestFrame = {
				type: "workflow.request",
				requestId,
				action,
				payload,
			};
			socket.send(JSON.stringify(frame));
		});
		socket.addEventListener("message", (event) => {
			const frame = parseWorkflowResponse(event.data);
			if (!frame || frame.requestId !== requestId) {
				return;
			}
			if (frame.status === "error") {
				finish(() => reject(new Error(`${frame.code}: ${frame.error}`)));
				return;
			}
			finish(() => resolve(frame.payload as T));
		});
		socket.addEventListener("error", () => {
			finish(() =>
				reject(
					workflowConnectionError(
						`Workflow websocket failed: ${url}. Start devos server/daemon or set DEVOS_SERVER_BASE_URL/DEVOS_WORKFLOW_WS_URL.`,
					),
				),
			);
		});
		socket.addEventListener("close", () => {
			finish(() =>
				reject(workflowConnectionError(`Workflow websocket closed: ${url}`)),
			);
		});
	});
}

function parseWorkflowResponse(
	data: unknown,
): WorkflowDataResponseFrame | undefined {
	if (typeof data !== "string") {
		return undefined;
	}
	try {
		const value = JSON.parse(data) as WorkflowDataResponseFrame;
		return value.type === "workflow.response" ? value : undefined;
	} catch {
		return undefined;
	}
}

function workflowConnectionError(message: string): Error {
	return new Error(message);
}
