export type SettingsModelStageId =
	| "brainstorm"
	| "implement"
	| "plan"
	| "testing";

export type SettingsReasoningEffort = "high" | "low" | "medium" | "xhigh";

export interface SettingsModelOption {
	id: string;
	label: string;
	description: string;
	defaultFor?: string[];
}

export interface SettingsModelStage {
	id: SettingsModelStageId;
	label: string;
	model?: string;
	reasoningEffort?: SettingsReasoningEffort;
}

export interface SettingsModelStageUpdate {
	id: SettingsModelStageId;
	model?: string | null;
	reasoningEffort?: SettingsReasoningEffort | null;
}

export interface SettingsModelsResponse {
	stages: SettingsModelStage[];
	availableModels: SettingsModelOption[];
	reasoningEfforts: SettingsReasoningEffort[];
}

export interface SettingsModelsUpdateRequest {
	stages: SettingsModelStageUpdate[];
}
