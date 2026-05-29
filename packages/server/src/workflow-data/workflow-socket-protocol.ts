import type {
	WorkflowCliCommandRequest,
	WorkflowClientCommandFrame,
	WorkflowCommandStreamFrame,
	WorkflowDataAction,
	WorkflowDataRequestFrame,
	WorkflowDataResponseFrame,
	WorkflowPingFrame,
	WorkflowSocketInboundFrame,
	WorkflowWorkerReadyFrame,
} from "./types/workflow-data.types";
import { parseComputerRegistration } from "./workflow-computer-registration";

const WORKFLOW_ACTIONS = new Set<string>([
	"tasks.list",
	"tasks.getByKey",
	"tasks.createWorkflowTask",
	"tasks.createIntakeTask",
	"tasks.update",
	"tasks.addComment",
	"tasks.linkPullRequest",
	"chat.publishClarification",
	"chat.listClarificationAnswers",
	"taskExecutions.start",
	"taskExecutions.appendStream",
	"taskExecutions.recordProgress",
	"taskExecutions.finish",
	"polling.record",
]);

const STREAM_FRAME_TYPES = new Set([
	"start",
	"stdout",
	"stderr",
	"progress",
	"error",
	"complete",
]);

export function parseWorkflowSocketFrame(
	input: string,
):
	| { status: "ok"; frame: WorkflowSocketInboundFrame }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	let value: unknown;
	try {
		value = JSON.parse(input);
	} catch {
		return errorParseFrame("invalid_json", "Workflow frame must be JSON");
	}
	if (!isRecord(value) || typeof value.type !== "string") {
		return errorParseFrame("invalid_type", "Workflow frame type is invalid");
	}
	if (value.type === "workflow.request") {
		return parseDataRequest(value);
	}
	if (value.type === "command") {
		return parseCommandRequest(value);
	}
	if (value.type === "ping") {
		return parsePing(value);
	}
	if (value.type === "cli.worker.ready") {
		return parseWorkerReady(value);
	}
	if (STREAM_FRAME_TYPES.has(value.type)) {
		return parseStreamFrame(value);
	}
	return errorParseFrame(
		"invalid_type",
		`Unsupported frame type: ${value.type}`,
	);
}

function parseDataRequest(
	value: Record<string, unknown>,
):
	| { status: "ok"; frame: WorkflowDataRequestFrame }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	const requestId = readRequestId(value);
	if (!requestId) {
		return errorParseFrame("invalid_request_id", "requestId is required");
	}
	if (typeof value.action !== "string" || !value.action.trim()) {
		return errorParseFrame("invalid_action", "action is required", requestId);
	}
	if (!WORKFLOW_ACTIONS.has(value.action)) {
		return errorParseFrame(
			"invalid_action",
			`Unsupported workflow action: ${value.action}`,
			requestId,
		);
	}
	return {
		status: "ok",
		frame: {
			type: "workflow.request",
			requestId,
			action: value.action as WorkflowDataAction,
			payload: value.payload,
		},
	};
}

function parseCommandRequest(
	value: Record<string, unknown>,
):
	| { status: "ok"; frame: WorkflowClientCommandFrame }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	const requestId = readRequestId(value);
	if (!requestId) {
		return errorParseFrame("invalid_request_id", "requestId is required");
	}
	if (!isRecord(value.request) || typeof value.request.action !== "string") {
		return errorParseFrame(
			"invalid_request",
			"request.action is required",
			requestId,
		);
	}
	const request = value.request as unknown as WorkflowCliCommandRequest;
	return {
		status: "ok",
		frame: {
			type: "command",
			requestId,
			request,
		},
	};
}

function parsePing(
	value: Record<string, unknown>,
):
	| { status: "ok"; frame: WorkflowPingFrame }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	const requestId = readRequestId(value);
	if (!requestId) {
		return errorParseFrame("invalid_request_id", "requestId is required");
	}
	return { status: "ok", frame: { type: "ping", requestId } };
}

function parseWorkerReady(
	value: Record<string, unknown>,
):
	| { status: "ok"; frame: WorkflowWorkerReadyFrame }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	if (typeof value.workerId !== "string" || !value.workerId.trim()) {
		return errorParseFrame("invalid_worker", "workerId is required");
	}
	const computer = parseComputerRegistration(value.computer);
	if (computer.status === "error") {
		return computer;
	}
	return {
		status: "ok",
		frame: {
			type: "cli.worker.ready",
			workerId: value.workerId,
			...(computer.value ? { computer: computer.value } : {}),
		},
	};
}

function parseStreamFrame(
	value: Record<string, unknown>,
):
	| { status: "ok"; frame: WorkflowCommandStreamFrame }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	const requestId = readRequestId(value);
	if (!requestId) {
		return errorParseFrame("invalid_request_id", "requestId is required");
	}
	return {
		status: "ok",
		frame: { ...value, requestId } as WorkflowCommandStreamFrame,
	};
}

function readRequestId(value: Record<string, unknown>): string | undefined {
	return typeof value.requestId === "string" && value.requestId.trim()
		? value.requestId
		: undefined;
}

function errorParseFrame(
	code: string,
	error: string,
	requestId = "unknown",
): { status: "error"; frame: WorkflowDataResponseFrame } {
	return {
		status: "error",
		frame: {
			type: "workflow.response",
			requestId,
			status: "error",
			code,
			error,
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
