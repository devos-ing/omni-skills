import { AgentAdapterError } from "../adapter-error";
import type { AgentAdapterRunRequest } from "../types/agent-adapter.types";

export function mapOpenCodeError(
	command: string,
	args: string[],
	result: { code: number; stdout: string; stderr: string },
	context: { cwd?: string; request?: AgentAdapterRunRequest } = {},
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
			`${base}\nOpenCode binary not found. Install OpenCode or set OPENCODE_BINARY.`,
			command,
			args,
			result,
			context,
		);
	}
	if (
		(lower.includes("model") && lower.includes("not found")) ||
		lower.includes("unknown model")
	) {
		return buildError(
			`${base}\nThe specified OpenCode model was not found. Check OPENCODE_MODEL and your OpenCode provider config.`,
			command,
			args,
			result,
			context,
		);
	}
	if (
		lower.includes("connection refused") ||
		lower.includes("econnrefused") ||
		lower.includes("fetch failed")
	) {
		return buildError(
			`${base}\nOpenCode could not reach the local model provider. Start Ollama, LM Studio, or the configured OpenCode provider server.`,
			command,
			args,
			result,
			context,
		);
	}
	if (lower.includes("permission") || lower.includes("denied")) {
		return buildError(
			`${base}\nOpenCode permission flow blocked the run. Configure an OpenCode agent policy or set OPENCODE_DANGEROUSLY_SKIP_PERMISSIONS=true if appropriate.`,
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
	context: { cwd?: string; request?: AgentAdapterRunRequest },
): AgentAdapterError {
	return new AgentAdapterError({
		backend: "opencode",
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
