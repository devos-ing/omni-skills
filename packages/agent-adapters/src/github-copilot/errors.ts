import { AgentAdapterError } from "../adapter-error";
import type { AgentAdapterRunRequest } from "../types/agent-adapter.types";

interface GitHubCopilotErrorContext {
	cwd?: string;
	request?: AgentAdapterRunRequest;
}

export function mapGitHubCopilotError(
	command: string,
	args: string[],
	result: { code: number; stdout: string; stderr: string },
	context: GitHubCopilotErrorContext = {},
): Error {
	const output = result.stderr || result.stdout;
	const lower = output.toLowerCase();
	const base = `${command} ${args.join(" ")} failed with exit code ${result.code}`;

	if (
		result.code === 127 ||
		lower.includes("command not found") ||
		lower.includes("enoent")
	) {
		return buildError(
			`${base}\nGitHub Copilot CLI binary not found. Install GitHub Copilot CLI or set GITHUB_COPILOT_BINARY.`,
			command,
			args,
			result,
			context,
		);
	}
	if (
		lower.includes("auth") ||
		lower.includes("token") ||
		lower.includes("login") ||
		lower.includes("unauthorized")
	) {
		return buildError(
			`${base}\nGitHub Copilot CLI authentication failed. Run 'copilot auth' or set GITHUB_COPILOT_TOKEN.`,
			command,
			args,
			result,
			context,
		);
	}
	if (lower.includes("subscription") || lower.includes("policy")) {
		return buildError(
			`${base}\nGitHub Copilot CLI is unavailable for this account. Check Copilot subscription and organization policy.`,
			command,
			args,
			result,
			context,
		);
	}
	if (lower.includes("model") && lower.includes("not found")) {
		return buildError(
			`${base}\nThe specified GitHub Copilot model was not found. Check GITHUB_COPILOT_MODEL.`,
			command,
			args,
			result,
			context,
		);
	}
	if (lower.includes("permission") || lower.includes("approval")) {
		return buildError(
			`${base}\nGitHub Copilot CLI tool permission flow blocked the run. Configure GitHub Copilot tool allow or deny settings.`,
			command,
			args,
			result,
			context,
		);
	}

	return buildError(`${base}\n${output}`, command, args, result, context);
}

function buildError(
	message: string,
	command: string,
	args: string[],
	result: { code: number; stdout: string; stderr: string },
	context: GitHubCopilotErrorContext,
): AgentAdapterError {
	return new AgentAdapterError({
		backend: "github-copilot",
		message,
		command,
		args,
		cwd: context.cwd,
		code: result.code,
		stdout: result.stdout,
		stderr: result.stderr,
		traceId: context.request?.traceId,
	});
}
