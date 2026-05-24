import type { IncomingMessage } from "node:http";
import type { Duplex } from "node:stream";
import { WebSocket, WebSocketServer } from "ws";
import {
	WorkflowDataError,
	createWorkflowDataService,
} from "./workflow-data-service";
import type {
	WorkflowDataSocket,
	WorkflowDataSocketOptions,
	WorkflowDataSocketProxy,
	WorkflowDataWebSocketServer,
} from "./workflow-data-socket.types";
import type {
	WorkflowDataRequestFrame,
	WorkflowDataResponseFrame,
	WorkflowSocketInboundFrame,
	WorkflowSocketOutboundFrame,
} from "./workflow-data.types";
import { parseWorkflowSocketFrame } from "./workflow-socket-protocol";

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
	options: Pick<
		WorkflowDataSocketOptions,
		"commandBroker" | "db" | "realtimeEvents"
	>,
): void {
	const service = createWorkflowDataService(options.db, options.realtimeEvents);
	client.on("message", (message) => {
		void handleWorkflowSocketMessage(client, String(message), service, options);
	});
}

export function shouldHandleWorkflowDataUpgrade(
	request: IncomingMessage,
	path: string,
): boolean {
	const url = new URL(request.url ?? "/", "http://localhost");
	return url.pathname === path;
}

async function handleWorkflowSocketMessage(
	client: WorkflowDataSocket,
	message: string,
	service: ReturnType<typeof createWorkflowDataService>,
	options: Pick<WorkflowDataSocketOptions, "commandBroker">,
): Promise<void> {
	const parsed = parseWorkflowSocketFrame(message);
	if (parsed.status === "error") {
		sendFrame(client, parsed.frame);
		return;
	}
	const frame = parsed.frame;
	if (frame.type === "workflow.request") {
		await handleWorkflowDataRequest(client, frame, service);
		return;
	}
	if (frame.type === "ping") {
		sendFrame(client, { type: "pong", requestId: frame.requestId });
		return;
	}
	if (frame.type === "command") {
		await handleWorkflowCommand(client, frame, options);
		return;
	}
	if (frame.type === "cli.worker.ready") {
		options.commandBroker?.registerWorker(client, frame.workerId, frame.computer);
		return;
	}
	options.commandBroker?.handleWorkerFrame(frame);
}

async function handleWorkflowDataRequest(
	client: WorkflowDataSocket,
	request: WorkflowDataRequestFrame,
	service: ReturnType<typeof createWorkflowDataService>,
): Promise<void> {
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

async function handleWorkflowCommand(
	client: WorkflowDataSocket,
	frame: Extract<WorkflowSocketInboundFrame, { type: "command" }>,
	options: Pick<WorkflowDataSocketOptions, "commandBroker">,
): Promise<void> {
	if (!options.commandBroker) {
		sendFrame(client, {
			type: "error",
			requestId: frame.requestId,
			error: "Workflow command broker is unavailable",
		});
		return;
	}
	await options.commandBroker.dispatchCommand(frame, (event) => {
		sendFrame(client, event);
	});
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

function sendFrame(
	client: WorkflowDataSocket,
	frame: WorkflowDataResponseFrame | WorkflowSocketOutboundFrame,
) {
	if (client.readyState === WebSocket.OPEN) {
		client.send(JSON.stringify(frame));
	}
}
