import type {
	AgentAdapter,
	AgentAdapterRuntimeConfig,
	AgentBackend,
} from "./agent-adapter.types";

export type AgentStage =
	| "taskIntake"
	| "brainstorm"
	| "plan"
	| "implement"
	| "reviewTest"
	| "githubComment";

export interface AgentModelDefinition {
	id: string;
	label: string;
	description: string;
	defaultFor?: readonly AgentStage[];
}

export interface AgentConfigurationDocField {
	name: string;
	label: string;
	description: string;
	defaultValue?: string | number | boolean | readonly string[];
}

export interface AgentConfigurationDoc {
	backend: AgentBackend;
	label: string;
	description: string;
	env: readonly AgentConfigurationDocField[];
	configFields: readonly AgentConfigurationDocField[];
	defaults: {
		backend: AgentBackend;
		model: string;
		models?: Partial<Record<AgentStage, string>>;
	};
	availableModels: readonly AgentModelDefinition[];
}

export interface AgentBackendDefinition {
	backend: AgentBackend;
	label: string;
	description: string;
	defaultModel: string;
	availableModels: readonly AgentModelDefinition[];
	configurationDoc: AgentConfigurationDoc;
	createAdapter(config: AgentAdapterRuntimeConfig): AgentAdapter;
}

export interface AgentConfigurationInput {
	backend?: string;
	model?: string;
}

export interface AgentConfigurationResolveOptions {
	defaultBackend?: AgentBackend;
	defaultModel?: string;
	allowCustomModel?: boolean;
}

export interface ResolvedAgentConfiguration {
	backend: AgentBackend;
	model: string;
	backendDefinition: AgentBackendDefinition;
	modelDefinition?: AgentModelDefinition;
	isKnownModel: boolean;
}
