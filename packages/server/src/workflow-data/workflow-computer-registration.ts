import type { WorkflowDataResponseFrame } from "./workflow-data.types";
import type { WorkflowComputerRegistration } from "./workflow-computer.types";

export function parseComputerRegistration(
	value: unknown,
):
	| { status: "ok"; value?: WorkflowComputerRegistration }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	if (value === undefined) {
		return { status: "ok" };
	}
	if (!isRecord(value)) {
		return errorParseFrame("invalid_computer", "computer is invalid");
	}
	const strings = readComputerStrings(value);
	if (strings.status === "error") {
		return strings;
	}
	if (
		value.processId !== undefined &&
		typeof value.processId !== "number"
	) {
		return errorParseFrame("invalid_computer", "computer.processId is invalid");
	}
	if (value.user !== undefined && typeof value.user !== "string") {
		return errorParseFrame("invalid_computer", "computer.user is invalid");
	}
	return {
		status: "ok",
		value: {
			id: strings.value.id,
			name: strings.value.name,
			hostname: strings.value.hostname,
			platform: strings.value.platform,
			arch: strings.value.arch,
			cwd: strings.value.cwd,
			startedAt: strings.value.startedAt,
			...(value.processId !== undefined ? { processId: value.processId } : {}),
			...(value.user !== undefined ? { user: value.user } : {}),
		},
	};
}

function readComputerStrings(
	value: Record<string, unknown>,
):
	| {
			status: "ok";
			value: Pick<
				WorkflowComputerRegistration,
				"id" | "name" | "hostname" | "platform" | "arch" | "cwd" | "startedAt"
			>;
	  }
	| { status: "error"; frame: WorkflowDataResponseFrame } {
	const fields = [
		"id",
		"name",
		"hostname",
		"platform",
		"arch",
		"cwd",
		"startedAt",
	] as const;
	const strings = {} as Record<(typeof fields)[number], string>;
	for (const field of fields) {
		const fieldValue = value[field];
		if (typeof fieldValue !== "string" || !fieldValue.trim()) {
			return errorParseFrame(
				"invalid_computer",
				`computer.${field} is required`,
			);
		}
		strings[field] = fieldValue;
	}
	return { status: "ok", value: strings };
}

function errorParseFrame(
	code: string,
	error: string,
): { status: "error"; frame: WorkflowDataResponseFrame } {
	return {
		status: "error",
		frame: {
			type: "workflow.response",
			requestId: "unknown",
			status: "error",
			code,
			error,
		},
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
