import type { AgentResult } from "adapters";
import type { AgentStreamEvent } from "devos-agents";
import { logger, normalizeError } from "../../../utils/logger";
import { emitWorkflowProgress } from "../../server";
import type {
	AgentChatLogEntry,
	AgentChatLogRole,
	RunState,
} from "../../types";
import { appendAgentChatLog } from "../state-chat-log";

interface RunAgentWithChatLogOptions {
	workspacePath: string;
	projectId: string;
	issue: RunState["issue"];
	agentRole: AgentChatLogRole;
	agentBackend?: string;
	agentModel?: string;
	phrase?: string;
	skillPath: string;
	prompt: string;
	invoke: (input?: {
		onStream: (event: AgentStreamEvent) => void;
	}) => Promise<AgentResult>;
}

interface PersistedAgentChatLogResult {
	finalMessage: string;
	stdout: string;
	sessionId?: string;
	usage?: AgentResult["usage"];
	success: boolean;
	error?: string;
}

export async function runAgentWithChatLog(
	options: RunAgentWithChatLogOptions,
): Promise<AgentResult> {
	try {
		emitAgentProgress(options, "started");
		const result = await options.invoke({
			onStream: (event) => emitAgentStreamLog(options, event),
		});
		await persistAgentChatLog(options, {
			finalMessage: result.finalMessage,
			stdout: result.stdout,
			sessionId: result.sessionId,
			usage: result.usage,
			success: true,
		});
		emitAgentOutputLog(options, result);
		emitAgentProgress(options, "succeeded");
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await persistAgentChatLog(options, {
			finalMessage: "",
			stdout: "",
			success: false,
			error: message,
		});
		emitAgentErrorLog(options, message);
		emitAgentProgress(options, "failed", message);
		throw error;
	}
}

function emitAgentStreamLog(
	options: RunAgentWithChatLogOptions,
	event: AgentStreamEvent,
): void {
	if (!event.text.trim()) {
		return;
	}
	emitWorkflowProgress({
		kind: "log",
		...agentProgressMetadata(options),
		projectId: options.projectId,
		taskId: options.issue.id,
		issueKey: options.issue.key,
		stage: options.agentRole,
		stream: event.stream,
		level: event.stream === "stderr" ? "error" : "info",
		message: event.text,
	});
}

function emitAgentProgress(
	options: RunAgentWithChatLogOptions,
	status: "started" | "succeeded" | "failed",
	error?: string,
): void {
	emitWorkflowProgress({
		kind: "action",
		...agentProgressMetadata(options),
		projectId: options.projectId,
		taskId: options.issue.id,
		issueKey: options.issue.key,
		stage: options.agentRole,
		action: "agent",
		status,
		...(error ? { error } : {}),
	});
}

function emitAgentOutputLog(
	options: RunAgentWithChatLogOptions,
	result: AgentResult,
): void {
	const message = [result.finalMessage, result.stdout]
		.filter((part) => part.trim())
		.join("\n\n");
	if (!message) {
		return;
	}
	emitWorkflowProgress({
		kind: "log",
		...agentProgressMetadata(options),
		projectId: options.projectId,
		taskId: options.issue.id,
		issueKey: options.issue.key,
		stage: options.agentRole,
		stream: "stdout",
		level: "info",
		message,
	});
}

function emitAgentErrorLog(
	options: RunAgentWithChatLogOptions,
	message: string,
): void {
	emitWorkflowProgress({
		kind: "log",
		...agentProgressMetadata(options),
		projectId: options.projectId,
		taskId: options.issue.id,
		issueKey: options.issue.key,
		stage: options.agentRole,
		stream: "stderr",
		level: "error",
		message,
	});
}

function agentProgressMetadata(options: RunAgentWithChatLogOptions) {
	return {
		agentRole: options.agentRole,
		agentBackend: options.agentBackend,
		agentModel: options.agentModel,
		phrase: options.phrase ?? options.agentRole,
	};
}

async function persistAgentChatLog(
	options: RunAgentWithChatLogOptions,
	result: PersistedAgentChatLogResult,
): Promise<void> {
	const entry: AgentChatLogEntry = {
		projectId: options.projectId,
		issueKey: options.issue.key,
		issueId: options.issue.id,
		issueTitle: options.issue.title,
		agentRole: options.agentRole,
		skillPath: options.skillPath,
		prompt: options.prompt,
		finalMessage: result.finalMessage,
		stdout: result.stdout,
		sessionId: result.sessionId,
		usage: result.usage,
		success: result.success,
		error: result.error,
		recordedAt: new Date().toISOString(),
	};
	try {
		await appendAgentChatLog(options.workspacePath, options.projectId, entry);
	} catch (error) {
		logger.error(
			{
				projectId: options.projectId,
				issueKey: options.issue.key,
				agentRole: options.agentRole,
				skillPath: options.skillPath,
				err: normalizeError(error),
			},
			"Failed to append agent chat log entry",
		);
	}
}
