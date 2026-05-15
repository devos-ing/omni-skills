import type { CliCommandRequest } from "../server";
import type {
	CliDaemonInboundFrame,
	CliDaemonOutboundFrame,
} from "./command-daemon.types";

export function parseCliDaemonInboundFrame(
	input: string,
):
	| { status: "ok"; frame: CliDaemonInboundFrame }
	| { status: "error"; error: string } {
	let value: unknown;
	try {
		value = JSON.parse(input);
	} catch {
		return { status: "error", error: "Malformed daemon frame: invalid JSON" };
	}
	if (!isRecord(value) || typeof value.type !== "string") {
		return {
			status: "error",
			error: "Malformed daemon frame: type is required",
		};
	}
	if (!isNonEmptyString(value.requestId)) {
		return {
			status: "error",
			error: "Malformed daemon frame: requestId is required",
		};
	}
	if (value.type === "ping") {
		return {
			status: "ok",
			frame: { type: "ping", requestId: value.requestId },
		};
	}
	if (value.type !== "command") {
		return {
			status: "error",
			error: `Unsupported daemon frame type: ${value.type}`,
		};
	}
	if (!isRecord(value.request) || !isNonEmptyString(value.request.action)) {
		return {
			status: "error",
			error: "Malformed daemon command frame: request.action is required",
		};
	}
	return {
		status: "ok",
		frame: {
			type: "command",
			requestId: value.requestId,
			request: value.request as CliCommandRequest,
		},
	};
}

export function serializeCliDaemonFrame(frame: CliDaemonOutboundFrame): string {
	return JSON.stringify(frame);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}
