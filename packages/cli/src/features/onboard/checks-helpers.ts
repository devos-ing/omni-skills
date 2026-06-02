import type { CommandResult } from "../../utils/shell";
import { RTK_INSTALL_URL } from "./constants";
import type { OnboardCheck, OnboardCheckDeps } from "./types/onboard.types";

export async function safeRun(
	commandRunner: NonNullable<OnboardCheckDeps["runCommand"]>,
	command: string,
	args: string[],
	cwd: string,
): Promise<CommandResult> {
	try {
		return await commandRunner(command, args, { cwd });
	} catch (error) {
		return {
			code: 1,
			stdout: "",
			stderr: error instanceof Error ? error.message : String(error),
		};
	}
}

export function commandFailureMessage(result: CommandResult): string {
	const output = (result.stderr || result.stdout).trim();
	return output || `command exited with ${result.code}`;
}

export function formatMissingRtkMessage(): string {
	return `rtk binary not found. Install from: ${RTK_INSTALL_URL}`;
}

export function formatMissingDockerMessage(
	dockerBinary: string,
	result: CommandResult,
): string {
	const output = (result.stderr || result.stdout).trim();
	if (!output) {
		return `${dockerBinary} binary not found but required for codex.docker.enabled projects`;
	}
	return `${dockerBinary} unavailable for codex.docker.enabled projects: ${output}`;
}

export function formatMissingCursorAgentMessage(cursorBinary: string): string {
	return `${cursorBinary} binary not found. Install Cursor Agent CLI and run: cursor-agent login`;
}

export function formatMissingGitHubCopilotMessage(
	copilotBinary: string,
): string {
	return `${copilotBinary} binary not found. Install GitHub Copilot CLI or set GITHUB_COPILOT_BINARY`;
}
