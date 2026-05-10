import type { AgentResult } from "../agent-adapters";
import { logger, normalizeError } from "../utils/logger";
import { appendAgentChatLog } from "./state";
import type { AgentChatLogEntry, AgentChatLogRole, RunState } from "./types";

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
		const result = await options.invoke();
		await persistAgentChatLog(options, {
			finalMessage: result.finalMessage,
			stdout: result.stdout,
			sessionId: result.sessionId,
			usage: result.usage,
			success: true,
		});
		return result;
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		await persistAgentChatLog(options, {
			finalMessage: "",
			stdout: "",
			success: false,
			error: message,
		});
		throw error;
	}
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
