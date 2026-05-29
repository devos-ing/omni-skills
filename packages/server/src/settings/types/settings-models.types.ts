import type { AgentModelDefinition, CodexReasoningEffort } from "adapters";

export type SettingsModelStageId =
	| "brainstorm"
	| "implement"
	| "plan"
	| "testing";

export type SettingsModelConfigKey =
	| "brainstorm"
	| "implement"
	| "plan"
	| "reviewTest";

export interface SettingsModelStageDefinition {
	id: SettingsModelStageId;
	label: string;
	configKey: SettingsModelConfigKey;
}

export interface SettingsModelStage {
	id: SettingsModelStageId;
	label: string;
	model?: string;
	reasoningEffort?: CodexReasoningEffort;
}

export interface SettingsModelStageUpdate {
	id: SettingsModelStageId;
	model?: string | null;
	reasoningEffort?: CodexReasoningEffort | null;
}

export interface SettingsModelsUpdateRequest {
	stages: SettingsModelStageUpdate[];
}

export interface SettingsModelsResponse {
	stages: SettingsModelStage[];
	availableModels: AgentModelDefinition[];
	reasoningEfforts: CodexReasoningEffort[];
}
