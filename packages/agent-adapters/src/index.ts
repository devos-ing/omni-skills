import type {
	AgentAdapter,
	AgentAdapterRuntimeConfig,
	AgentBackend,
	AgentResult,
} from "./agent-adapter.types";
import { getAgentBackendDefinition } from "./registry";

export type {
	AgentAdapter,
	AgentAdapterRuntimeConfig,
	AgentBackend,
	AgentResult,
	CodexReasoningEffort,
} from "./agent-adapter.types";
export type {
	AgentBackendDefinition,
	AgentConfigurationDoc,
	AgentConfigurationDocField,
	AgentConfigurationInput,
	AgentConfigurationResolveOptions,
	AgentModelDefinition,
	AgentStage,
	ResolvedAgentConfiguration,
} from "./agent-registry.types";
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

export function createAgentAdapter(
	config: AgentAdapterRuntimeConfig,
	backend?: AgentBackend,
): AgentAdapter {
	const requestedBackend = backend ?? config.agent?.backend ?? "codex";
	const definition = getAgentBackendDefinition(requestedBackend);
	if (!definition) {
		throw new Error(`Unknown agent backend: ${requestedBackend}`);
	}
	return definition.createAdapter(config);
}
