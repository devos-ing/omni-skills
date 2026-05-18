import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import {
	WorkflowDataError,
	createWorkflowDataService,
} from "./workflow-data-service";
import type {
	WorkflowDataAction,
	WorkflowDataRequestFrame,
	WorkflowDataResponseFrame,
} from "./workflow-data.types";
import type {
	WorkflowDataSocket,
	WorkflowDataSocketOptions,
	WorkflowDataSocketProxy,
	WorkflowDataWebSocketServer,
} from "./workflow-data-socket.types";

const WORKFLOW_ACTIONS = new Set<string>([
	"tasks.list",
	"tasks.getByKey",
	"tasks.createWorkflowTask",
	"tasks.createIntakeTask",
	"tasks.update",
	"tasks.addComment",
	"tasks.linkPullRequest",
	"polling.record",
]);

export function attachWorkflowDataSocket(
	options: WorkflowDataSocketOptions,
	WebSocketServerImpl: new (options: {
		noServer: true;
	}) => WorkflowDataWebSocketServer = WebSocketServer,
): WorkflowDataSocketProxy {
	const webSocketServer = new WebSocketServerImpl({ noServer: true });
	const onUpgrade = (
		request: IncomingMessage,
		socket: Duplex,
		head: Buffer,
	): void => {
		if (!shouldHandleWorkflowDataUpgrade(request, options.path)) {
			return;
		}
		webSocketServer.handleUpgrade(request, socket, head, (client) => {
			webSocketServer.emit("connection", client);
		});
	};

	webSocketServer.on("connection", (client) => {
		bindWorkflowDataClient(client, options);
	});
	options.server.on("upgrade", onUpgrade);

	return {
		close: () =>
			new Promise((resolve, reject) => {
				options.server.off("upgrade", onUpgrade);
				webSocketServer.close((error) => (error ? reject(error) : resolve()));
			}),
	};
}

export function bindWorkflowDataClient(
	client: WorkflowDataSocket,
	options: Pick<WorkflowDataSocketOptions, "db" | "realtimeEvents">,
): void {
	const service = createWorkflowDataService(options.db, options.realtimeEvents);
	client.on("message", (message) => {
		void handleWorkflowDataMessage(client, String(message), service);
	});
}

export function shouldHandleWorkflowDataUpgrade(
	request: IncomingMessage,
	path: string,
): boolean {
	const url = new URL(request.url ?? "/", "http://localhost");
	return url.pathname === path;
}

async function handleWorkflowDataMessage(
	client: WorkflowDataSocket,
	message: string,
	service: ReturnType<typeof createWorkflowDataService>,
): Promise<void> {
	const parsed = parseWorkflowDataRequest(message);
	if (parsed.status === "error") {
		sendFrame(client, parsed.frame);
		return;
	}
	const request = parsed.frame;
	try {
		const payload = await service.handle(request.action, request.payload);
		sendFrame(client, {
			type: "workflow.response",
			requestId: request.requestId,
			action: request.action,
			status: "ok",
			payload,
		});
	} catch (error) {
		sendFrame(client, toErrorFrame(request, error));
	}
}

function parseWorkflowDataRequest(input: string):
	| { status: "ok"; frame: WorkflowDataRequestFrame }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	let value: unknown;
	try {
		value = JSON.parse(input);
	} catch {
		return errorParseFrame("invalid_json", "Workflow frame must be JSON");
	}
	if (!isRecord(value) || value.type !== "workflow.request") {
		return errorParseFrame("invalid_type", "Workflow frame type is invalid");
	}
	if (typeof value.requestId !== "string" || !value.requestId.trim()) {
		return errorParseFrame("invalid_request_id", "requestId is required");
	}
	if (typeof value.action !== "string" || !value.action.trim()) {
		return errorParseFrame("invalid_action", "action is required", value.requestId);
	}
	if (!WORKFLOW_ACTIONS.has(value.action)) {
		return errorParseFrame(
			"invalid_action",
			`Unsupported workflow action: ${value.action}`,
			value.requestId,
		);
	}
	return {
		status: "ok",
		frame: {
			...value,
			action: value.action as WorkflowDataAction,
		} as WorkflowDataRequestFrame,
	};
}

function errorParseFrame(
	code: string,
	error: string,
	requestId = "unknown",
): { status: "error"; frame: WorkflowDataResponseFrame } {
	return {
		status: "error",
		frame: { type: "workflow.response", requestId, status: "error", code, error },
	};
}

function toErrorFrame(
	request: WorkflowDataRequestFrame,
	error: unknown,
): WorkflowDataResponseFrame {
	const code = error instanceof WorkflowDataError ? error.code : "server_error";
	const message = error instanceof Error ? error.message : String(error);
	return {
		type: "workflow.response",
		requestId: request.requestId,
		action: request.action,
		status: "error",
		code,
		error: message,
	};
}

function sendFrame(client: WorkflowDataSocket, frame: WorkflowDataResponseFrame) {
	if (client.readyState === WebSocket.OPEN) {
		client.send(JSON.stringify(frame));
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
