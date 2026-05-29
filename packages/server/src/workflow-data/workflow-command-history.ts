import type {
	CliCommandExecutionHistoryEntry,
	CliCommandExecutionResult,
} from "devos/features/server";

export function recordWorkflowCommandHistory(
	history: CliCommandExecutionHistoryEntry[],
	historyLimit: number,
	requestedAt: string,
	result: CliCommandExecutionResult,
): void {
	history.push({
		requestedAt,
		finishedAt: new Date().toISOString(),
		request: result.request,
		status: result.status,
		command: result.invocation?.command,
		args: result.invocation?.args,
		exitCode: result.commandResult?.code,
		stdout: result.commandResult?.stdout,
		stderr: result.commandResult?.stderr,
		error: result.error,
	});
	if (history.length > historyLimit) {
		history.splice(0, history.length - historyLimit);
	}
}
