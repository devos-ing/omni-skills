import type { RunState } from "adhdai/features/types";
import type { NotificationRequest } from "./notifications.types";

export async function parseNotificationRequest(
	request: Request,
): Promise<
	| { status: "ok"; request: NotificationRequest }
	| { status: "error"; error: string }
> {
	let body: unknown;
	try {
		body = await request.json();
	} catch {
		return { status: "error", error: "Malformed JSON body" };
	}

	if (!isRecord(body)) {
		return {
			status: "error",
			error: "Malformed notification request: expected object body",
		};
	}
	if (body.type === "task_outcome") {
		return parseTaskOutcome(body);
	}
	if (body.type === "human_review_required") {
		return parseHumanReview(body);
	}
	return {
		status: "error",
		error: "Malformed notification request: unsupported type",
	};
}

function parseTaskOutcome(
	body: Record<string, unknown>,
):
	| { status: "ok"; request: NotificationRequest }
	| { status: "error"; error: string } {
	if (!isRunState(body.state)) {
		return {
			status: "error",
			error: "Malformed notification request: state is required",
		};
	}
	if (body.outcome !== "done" && body.outcome !== "blocked") {
		return {
			status: "error",
			error: "Malformed notification request: invalid outcome",
		};
	}
	if (
		body.errorMessage !== undefined &&
		typeof body.errorMessage !== "string"
	) {
		return {
			status: "error",
			error: "Malformed notification request: errorMessage must be a string",
		};
	}
	return {
		status: "ok",
		request: {
			type: "task_outcome",
			state: body.state,
			outcome: body.outcome,
			errorMessage: body.errorMessage,
		},
	};
}

function parseHumanReview(
	body: Record<string, unknown>,
):
	| { status: "ok"; request: NotificationRequest }
	| { status: "error"; error: string } {
	if (!isRunState(body.state)) {
		return {
			status: "error",
			error: "Malformed notification request: state is required",
		};
	}
	if (
		typeof body.complexityScore !== "number" ||
		!Number.isFinite(body.complexityScore)
	) {
		return {
			status: "error",
			error: "Malformed notification request: complexityScore must be a number",
		};
	}
	if (typeof body.reason !== "string" || body.reason.trim().length === 0) {
		return {
			status: "error",
			error:
				"Malformed notification request: reason must be a non-empty string",
		};
	}
	return {
		status: "ok",
		request: {
			type: "human_review_required",
			state: body.state,
			complexityScore: body.complexityScore,
			reason: body.reason,
		},
	};
}

function isRunState(value: unknown): value is RunState {
	if (!isRecord(value)) {
		return false;
	}
	const issue = value.issue;
	return (
		typeof value.projectId === "string" &&
		typeof value.projectName === "string" &&
		typeof value.updatedAt === "string" &&
		isRecord(issue) &&
		typeof issue.key === "string" &&
		typeof issue.title === "string" &&
		typeof issue.url === "string"
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
