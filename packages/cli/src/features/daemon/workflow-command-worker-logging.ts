import type { CliCommandRequest, CliCommandStreamEvent } from "../server";
import type { WorkflowCommandWorkerLogger } from "./workflow-command-worker.types";

export function logWorkerActionReceived(
	workerLogger: WorkflowCommandWorkerLogger,
	requestId: string,
	request: CliCommandRequest,
): void {
	workerLogger.info(
		buildWorkerActionLogContext(requestId, request),
		"CLI worker action received",
	);
}

export function logWorkerStreamEvent(
	workerLogger: WorkflowCommandWorkerLogger,
	requestId: string,
	request: CliCommandRequest,
	event: CliCommandStreamEvent,
): void {
	if (event.type === "error") {
		workerLogger.error(
			{
				...buildWorkerActionLogContext(requestId, request),
				error: event.error,
			},
			"CLI worker action error",
		);
	}
	if (event.type === "complete") {
		workerLogger.info(
			pickDefined({
				...buildWorkerActionLogContext(requestId, request),
				status: event.result.status,
				exitCode: event.result.commandResult?.code,
			}),
			"CLI worker action completed",
		);
	}
}

export function buildWorkerActionLogContext(
	requestId: string,
	request: CliCommandRequest,
): Record<string, unknown> {
	const fields = request as Record<string, unknown>;
	return pickDefined({
		requestId,
		action: request.action,
		projectId: stringField(fields.projectId),
		issueKey: stringField(fields.issueKey),
		allProjects: booleanField(fields.allProjects),
		poll: booleanField(fields.poll),
		pollForever: booleanField(fields.pollForever),
		skillsAction: stringField(fields.skillsAction),
		taskAction: stringField(fields.taskAction),
	});
}

function pickDefined(
	input: Record<string, unknown | undefined>,
): Record<string, unknown> {
	return Object.fromEntries(
		Object.entries(input).filter(([, value]) => value !== undefined),
	);
}

function stringField(value: unknown): string | undefined {
	return typeof value === "string" ? value : undefined;
}

function booleanField(value: unknown): boolean | undefined {
	return typeof value === "boolean" ? value : undefined;
}
