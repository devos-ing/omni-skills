import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { WebSocket } from "ws";
import type { WorkflowDataSocket } from "../src/workflow-data/workflow-data-socket.types";

export async function sendWorkflowDataRequest(
	socket: FakeWorkflowDataSocket,
	action: string,
	payload?: unknown,
) {
	const requestId = crypto.randomUUID();
	socket.emitMessage(
		JSON.stringify({ type: "workflow.request", requestId, action, payload }),
	);
	return JSON.parse(await socket.nextSend()) as { payload: unknown };
}

export function request(url: string): IncomingMessage {
	return { url } as IncomingMessage;
}

export class FakeWorkflowDataSocket
	extends EventEmitter
	implements WorkflowDataSocket
{
	readyState: number = WebSocket.OPEN;
	readonly sent: string[] = [];
	private sendResolver: ((message: string) => void) | undefined;

	send(message: string): void {
		if (this.sendResolver) {
			this.sendResolver(message);
			this.sendResolver = undefined;
			return;
		}
		this.sent.push(message);
	}

	close(): void {
		this.readyState = WebSocket.CLOSED;
	}

	emitMessage(message: string): void {
		this.emit("message", message);
	}

	nextSend(): Promise<string> {
		const sent = this.sent.shift();
		if (sent) {
			return Promise.resolve(sent);
		}
		return new Promise((resolve) => {
			this.sendResolver = resolve;
		});
	}
}
