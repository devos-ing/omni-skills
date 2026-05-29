import type {
	InstanceConfigLoadResult,
	OnboardInstanceConfig,
} from "../../onboard";

export type ModelStage =
	| "brainstorm"
	| "githubComment"
	| "implement"
	| "plan"
	| "reviewTest";

export type ModelReasoningEffort = "high" | "low" | "medium" | "xhigh";

export type ModelsCommand =
	| { action: "list" }
	| {
			action: "set";
			stage: ModelStage;
			model?: string;
			reasoningEffort?: ModelReasoningEffort;
	  }
	| { action: "reset"; stage: ModelStage };

export interface ModelsCommandDeps {
	loadInstanceConfig?: (cwd: string) => Promise<InstanceConfigLoadResult>;
	saveInstanceConfig?: (config: OnboardInstanceConfig) => Promise<void>;
	write?: (message: string) => void;
}
