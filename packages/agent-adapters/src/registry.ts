import { ClaudeCodeAdapter, claudeConfigurationDoc } from "./claude";
import {
	CLAUDE_AVAILABLE_MODELS,
	CLAUDE_BACKEND,
	CLAUDE_DEFAULT_MODEL,
	CLAUDE_DESCRIPTION,
	CLAUDE_LABEL,
} from "./claude/constants";
import { CodexAdapter, codexConfigurationDoc } from "./codex";
import {
	CODEX_AVAILABLE_MODELS,
	CODEX_BACKEND,
	CODEX_DEFAULT_MODEL,
	CODEX_DESCRIPTION,
	CODEX_LABEL,
} from "./codex/constants";
import { CursorAgentAdapter, cursorConfigurationDoc } from "./cursor";
import {
	CURSOR_AVAILABLE_MODELS,
	CURSOR_BACKEND,
	CURSOR_DEFAULT_MODEL,
	CURSOR_DESCRIPTION,
	CURSOR_LABEL,
} from "./cursor/constants";
import { GitHubCopilotAdapter } from "./github-copilot/adapter";
import { githubCopilotConfigurationDoc } from "./github-copilot/configuration-doc";
import {
	GITHUB_COPILOT_AVAILABLE_MODELS,
	GITHUB_COPILOT_BACKEND,
	GITHUB_COPILOT_DEFAULT_MODEL,
	GITHUB_COPILOT_DESCRIPTION,
	GITHUB_COPILOT_LABEL,
} from "./github-copilot/constants";
import { OpenCodeAdapter } from "./opencode/adapter";
import { opencodeConfigurationDoc } from "./opencode/configuration-doc";
import {
	OPENCODE_AVAILABLE_MODELS,
	OPENCODE_BACKEND,
	OPENCODE_DEFAULT_MODEL,
	OPENCODE_DESCRIPTION,
	OPENCODE_LABEL,
} from "./opencode/constants";
import type { AgentBackend } from "./types/agent-adapter.types";
import type {
	AgentBackendDefinition,
	AgentConfigurationDoc,
	AgentConfigurationInput,
	AgentConfigurationResolveOptions,
	AgentModelDefinition,
	ResolvedAgentConfiguration,
} from "./types/agent-registry.types";

const agentBackendDefinitions = {
	[CODEX_BACKEND]: {
		backend: CODEX_BACKEND,
		label: CODEX_LABEL,
		description: CODEX_DESCRIPTION,
		defaultModel: CODEX_DEFAULT_MODEL,
		availableModels: CODEX_AVAILABLE_MODELS,
		configurationDoc: codexConfigurationDoc,
		createAdapter: (config) => new CodexAdapter(config),
	},
	[CLAUDE_BACKEND]: {
		backend: CLAUDE_BACKEND,
		label: CLAUDE_LABEL,
		description: CLAUDE_DESCRIPTION,
		defaultModel: CLAUDE_DEFAULT_MODEL,
		availableModels: CLAUDE_AVAILABLE_MODELS,
		configurationDoc: claudeConfigurationDoc,
		createAdapter: (config) => new ClaudeCodeAdapter(config),
	},
	[CURSOR_BACKEND]: {
		backend: CURSOR_BACKEND,
		label: CURSOR_LABEL,
		description: CURSOR_DESCRIPTION,
		defaultModel: CURSOR_DEFAULT_MODEL,
		availableModels: CURSOR_AVAILABLE_MODELS,
		configurationDoc: cursorConfigurationDoc,
		createAdapter: (config) => new CursorAgentAdapter(config),
	},
	[GITHUB_COPILOT_BACKEND]: {
		backend: GITHUB_COPILOT_BACKEND,
		label: GITHUB_COPILOT_LABEL,
		description: GITHUB_COPILOT_DESCRIPTION,
		defaultModel: GITHUB_COPILOT_DEFAULT_MODEL,
		availableModels: GITHUB_COPILOT_AVAILABLE_MODELS,
		configurationDoc: githubCopilotConfigurationDoc,
		createAdapter: (config) => new GitHubCopilotAdapter(config),
	},
	[OPENCODE_BACKEND]: {
		backend: OPENCODE_BACKEND,
		label: OPENCODE_LABEL,
		description: OPENCODE_DESCRIPTION,
		defaultModel: OPENCODE_DEFAULT_MODEL,
		availableModels: OPENCODE_AVAILABLE_MODELS,
		configurationDoc: opencodeConfigurationDoc,
		createAdapter: (config) => new OpenCodeAdapter(config),
	},
} satisfies Record<AgentBackend, AgentBackendDefinition>;

export const availableAgentModels = mapAgentModels();
export const agentConfigurationDoc = mapConfigurationDocs();

export function listAgentBackends(): readonly AgentBackendDefinition[] {
	return Object.values(agentBackendDefinitions);
}

export function getAgentBackendDefinition(
	backend: string | undefined,
): AgentBackendDefinition | undefined {
	const normalized = normalizeAgentBackend(backend);
	return normalized ? agentBackendDefinitions[normalized] : undefined;
}

export function normalizeAgentBackend(
	backend: string | undefined,
): AgentBackend | undefined {
	const normalized = backend?.trim().toLowerCase();
	if (!normalized) {
		return undefined;
	}
	return normalized in agentBackendDefinitions
		? (normalized as AgentBackend)
		: undefined;
}

export function resolveAgentConfiguration(
	input: AgentConfigurationInput,
	options: AgentConfigurationResolveOptions = {},
): ResolvedAgentConfiguration {
	const backend = resolveBackend(input.backend, options.defaultBackend);
	const backendDefinition = agentBackendDefinitions[backend];
	const model = resolveModel(
		input.model,
		options.defaultModel,
		backendDefinition,
	);
	const modelDefinition = findModel(backendDefinition.availableModels, model);
	if (!modelDefinition && options.allowCustomModel === false) {
		throw new Error(`Unknown ${backend} model: ${model}`);
	}
	return {
		backend,
		model,
		backendDefinition,
		...(modelDefinition ? { modelDefinition } : {}),
		isKnownModel: Boolean(modelDefinition),
	};
}

function resolveBackend(
	inputBackend: string | undefined,
	defaultBackend: AgentBackend | undefined,
): AgentBackend {
	const normalizedInput = normalizeAgentBackend(inputBackend);
	if (inputBackend?.trim() && !normalizedInput) {
		throw new Error(`Unknown agent backend: ${inputBackend}`);
	}
	const backend = normalizedInput ?? defaultBackend;
	if (!backend) {
		throw new Error("Agent backend is required");
	}
	if (!agentBackendDefinitions[backend]) {
		throw new Error(`Unknown agent backend: ${inputBackend ?? backend}`);
	}
	return backend;
}

function resolveModel(
	inputModel: string | undefined,
	defaultModel: string | undefined,
	backendDefinition: AgentBackendDefinition,
): string {
	return inputModel?.trim() || defaultModel || backendDefinition.defaultModel;
}

function findModel(
	models: readonly AgentModelDefinition[],
	model: string,
): AgentModelDefinition | undefined {
	return models.find((candidate) => candidate.id === model);
}

function mapAgentModels(): Record<
	AgentBackend,
	readonly AgentModelDefinition[]
> {
	return Object.fromEntries(
		listAgentBackends().map((definition) => [
			definition.backend,
			definition.availableModels,
		]),
	) as Record<AgentBackend, readonly AgentModelDefinition[]>;
}

function mapConfigurationDocs(): Record<AgentBackend, AgentConfigurationDoc> {
	return Object.fromEntries(
		listAgentBackends().map((definition) => [
			definition.backend,
			definition.configurationDoc,
		]),
	) as Record<AgentBackend, AgentConfigurationDoc>;
}
