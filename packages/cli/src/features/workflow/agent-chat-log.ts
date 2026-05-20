import type { AgentResult } from "adapters";
import type {
	AgentChatLogEntry,
	AgentChatLogRole,
	RunState,
} from "../../features/types";
import { logger, normalizeError } from "../../utils/logger";
import { emitWorkflowProgress } from "../server";
import { appendAgentChatLog } from "./state";

interface RunAgentWithChatLogOptions {
	workspacePath: string;
	projectId: string;
	issue: RunState["issue"];
	agentRole: AgentChatLogRole;
	skillPath: string;
	prompt: string;
	invoke: () => Promise<AgentResult>;
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
		const result = await options.invoke();
		await persistAgentChatLog(options, {
			finalMessage: result.finalMessage,
			stdout: result.stdout,
			sessionId: result.sessionId,
			usage: result.usage,
			success: true,
		});
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
		emitAgentProgress(options, "failed", message);
		throw error;
	}
}

function emitAgentProgress(
	options: RunAgentWithChatLogOptions,
	status: "started" | "succeeded" | "failed",
	error?: string,
): void {
	emitWorkflowProgress({
		kind: "action",
		projectId: options.projectId,
		issueKey: options.issue.key,
		stage: options.agentRole,
		action: "agent",
		agentRole: options.agentRole,
		status,
		...(error ? { error } : {}),
	});
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
