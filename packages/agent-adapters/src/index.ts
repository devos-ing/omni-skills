import { getAgentBackendDefinition } from "./registry";
import type {
	AgentAdapter,
	AgentAdapterRunRequest,
	AgentAdapterRunRole,
	AgentAdapterRuntimeConfig,
	AgentBackend,
	AgentResult,
} from "./types/agent-adapter.types";
export { AgentAdapterError } from "./adapter-error";

export type {
	AgentAdapter,
	AgentAdapterRunRequest,
	AgentAdapterRunRole,
	AgentAdapterRuntimeConfig,
	AgentBackend,
	AgentResult,
	CodexReasoningEffort,
} from "./types/agent-adapter.types";
export type {
	AgentBackendDefinition,
	AgentConfigurationDoc,
	AgentConfigurationDocField,
	AgentConfigurationInput,
	AgentConfigurationResolveOptions,
	AgentModelDefinition,
	AgentStage,
	ResolvedAgentConfiguration,
} from "./types/agent-registry.types";
export {
	agentConfigurationDoc,
	availableAgentModels,
	getAgentBackendDefinition,
	listAgentBackends,
	normalizeAgentBackend,
	resolveAgentConfiguration,
} from "./registry";
export { assertCommandOk, runCommand } from "./shell";
export type { CommandResult, RunCommandOptions } from "./shell";
import {
	validateAgentAdapterRunRequest,
	validateAgentAdapterRuntimeConfig,
} from "./validation";

export function createAgentAdapter(
	config: AgentAdapterRuntimeConfig,
	backend?: AgentBackend,
): AgentAdapter {
	const validatedConfig = validateAgentAdapterRuntimeConfig(config);
	const requestedBackend = backend ?? config.agent?.backend ?? "codex";
	const definition = getAgentBackendDefinition(requestedBackend);
	if (!definition) {
		throw new Error(`Unknown agent backend: ${requestedBackend}`);
	}
	return definition.createAdapter(validatedConfig);
}

export async function runAdapterAgent(
	adapter: AgentAdapter,
	request: AgentAdapterRunRequest,
): Promise<AgentResult> {
	const validatedRequest = validateAgentAdapterRunRequest(request);
	if (adapter.runAgent) {
		return adapter.runAgent(validatedRequest);
	}
	if (validatedRequest.sessionId) {
		return adapter.resume(validatedRequest.sessionId, validatedRequest.prompt);
	}
	if (validatedRequest.role === "task-intake") {
		return adapter.runTaskIntake(validatedRequest.prompt);
	}
	if (validatedRequest.role === "review-testing") {
		return adapter.runReview(validatedRequest.prompt);
	}
	if (validatedRequest.role === "github-comment") {
		return adapter.runGithubComment(validatedRequest.prompt);
	}
	return adapter.runPlan(validatedRequest.prompt);
}
