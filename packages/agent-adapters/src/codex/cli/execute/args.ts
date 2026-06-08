import type {
	AgentAdapterRunRequest,
	AgentAdapterRuntimeConfig,
	CodexReasoningEffort,
} from "../../../types/agent-adapter.types";
import { buildCodexConfigOverrides } from "../skills/config-overrides";

interface CodexArgsInput {
	config: AgentAdapterRuntimeConfig;
	request: AgentAdapterRunRequest;
	prompt: string;
	outputFile: string;
	modelOverride?: string;
	reasoningEffortOverride?: CodexReasoningEffort;
	fastModeEnabled?: boolean;
}

export function buildCodexExecArgs(input: CodexArgsInput): string[] {
	const args = [
		"exec",
		"--json",
		"--skip-git-repo-check",
		"--ignore-user-config",
		"--cd",
		input.config.executionPath,
		"--output-last-message",
		input.outputFile,
	];
	appendCodexModelAndRuntimeArgs(args, input);
	args.push(input.prompt);
	return args;
}

export function buildCodexResumeArgs(input: CodexArgsInput): string[] {
	const args = [
		"exec",
		"--add-dir",
		input.config.executionPath,
		"resume",
		"--json",
		"--skip-git-repo-check",
		"--ignore-user-config",
		"--output-last-message",
		input.outputFile,
	];
	appendCodexModelAndRuntimeArgs(args, input);
	args.push(input.request.sessionId ?? "", input.prompt);
	return args;
}

function appendCodexModelAndRuntimeArgs(
	args: string[],
	input: CodexArgsInput,
): void {
	const model = input.modelOverride ?? input.config.codex.model;
	if (model) {
		args.push("--model", model);
	}
	appendCodexSandboxArgs(args, input.config.codex.sandbox);
	for (const override of buildCodexConfigOverrides(
		input.config,
		input.request,
		input.reasoningEffortOverride,
		input.fastModeEnabled,
	)) {
		args.push("--config", override);
	}
}

function appendCodexSandboxArgs(
	args: string[],
	sandbox: AgentAdapterRuntimeConfig["codex"]["sandbox"],
): void {
	if (!sandbox || args[0] !== "exec") {
		return;
	}
	if (args.includes("resume")) {
		args.push("--config", `sandbox_mode="${sandbox}"`);
		return;
	}
	args.push("--sandbox", sandbox);
}
