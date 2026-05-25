import type { Dispatch, SetStateAction } from "react";

import type {
	ChatMessageCreateRequest,
	ChatMessageRecord,
	ChatSessionRecord,
} from "@/lib/api";
import { createWebApiClient } from "@/lib/api/web-client";

import { commandFinalText } from "./chat-command-utils";
import type {
	ChatStreamLine,
	CommandRunResult,
	ParsedChatCommand,
} from "./types/chat-room.types";

const apiClient = createWebApiClient();

export interface ChatCommandActionContext {
	appendMessage(input: {
		message: ChatMessageCreateRequest;
		sessionId: string;
	}): Promise<ChatMessageRecord>;
	setStreamLines: Dispatch<SetStateAction<ChatStreamLine[]>>;
	startNewSession(): Promise<void>;
	updateProject(input: {
		projectId: string;
		sessionId: string;
	}): Promise<ChatSessionRecord>;
}

export async function executeCommandInput(
	context: ChatCommandActionContext,
	sessionId: string,
	content: string,
	command: Exclude<ParsedChatCommand, { kind: "none" }>,
): Promise<void> {
	if (command.kind === "error") {
		await persistCommandError(context, sessionId, content, command.error);
		return;
	}
	if (command.kind === "local") {
		await executeLocalCommand(context, sessionId, content, command);
		return;
	}
	await executeStreamCommand(context, sessionId, content, command);
}

async function executeLocalCommand(
	context: ChatCommandActionContext,
	sessionId: string,
	content: string,
	command: Extract<ParsedChatCommand, { kind: "local" }>,
): Promise<void> {
	if (command.action === "new") {
		await context.startNewSession();
		return;
	}
	const session = await context.updateProject({
		sessionId,
		projectId: command.projectId,
	});
	await context.appendMessage({
		sessionId,
		message: { role: "user", kind: "command", content },
	});
	await context.appendMessage({
		sessionId,
		message: {
			role: "system",
			kind: "command",
			content: `Project set to ${session.projectId}`,
			commandAction: "project",
		},
	});
}

async function executeStreamCommand(
	context: ChatCommandActionContext,
	sessionId: string,
	content: string,
	command: Extract<ParsedChatCommand, { kind: "stream" }>,
): Promise<void> {
	await context.appendMessage({
		sessionId,
		message: { role: "user", kind: "command", content },
	});
	await context.appendMessage({
		sessionId,
		message: {
			role: "system",
			kind: "command",
			content: `Running ${command.label}`,
			commandAction: command.action,
		},
	});
	const result = await runCommand(context, command);
	await context.appendMessage({
		sessionId,
		message: {
			role: result.status === "succeeded" ? "assistant" : "system",
			kind: result.status === "succeeded" ? "command" : "error",
			content: commandFinalText(
				result.status,
				result.events.map(eventText).filter(Boolean).join("\n"),
			),
			commandAction: command.action,
			metadata: { status: result.status },
		},
	});
	context.setStreamLines([]);
}

async function runCommand(
	context: ChatCommandActionContext,
	command: Extract<ParsedChatCommand, { kind: "stream" }>,
): Promise<CommandRunResult> {
	const events: CommandRunResult["events"] = [];
	let status: CommandRunResult["status"] = "failed";
	await apiClient.streamCliCommand(command.request, (event) => {
		events.push(event);
		const text = eventText(event);
		if (text) {
			context.setStreamLines((current) => [
				...current,
				{ id: crypto.randomUUID(), stream: eventStream(event), text },
			]);
		}
		if (event.type === "complete") {
			status = event.result.status;
		}
	});
	return { events, status };
}

async function persistCommandError(
	context: ChatCommandActionContext,
	sessionId: string,
	content: string,
	error: string,
): Promise<void> {
	await context.appendMessage({
		sessionId,
		message: { role: "user", kind: "command", content },
	});
	await context.appendMessage({
		sessionId,
		message: { role: "system", kind: "error", content: error },
	});
}

function eventText(event: CommandRunResult["events"][number]): string {
	if (event.type === "stdout" || event.type === "stderr") {
		return event.text.trimEnd();
	}
	if (event.type === "error") {
		return event.error;
	}
	return event.type === "progress" && typeof event.event.message === "string"
		? event.event.message
		: "";
}

function eventStream(
	event: CommandRunResult["events"][number],
): ChatStreamLine["stream"] {
	return event.type === "stderr" || event.type === "error"
		? "stderr"
		: event.type === "stdout"
			? "stdout"
			: "system";
}
