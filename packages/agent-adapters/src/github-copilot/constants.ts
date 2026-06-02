import type { AgentBackend } from "../types/agent-adapter.types";
import type { AgentModelDefinition } from "../types/agent-registry.types";

export const GITHUB_COPILOT_BACKEND = "github-copilot" satisfies AgentBackend;
export const GITHUB_COPILOT_LABEL = "GitHub Copilot";
export const GITHUB_COPILOT_DESCRIPTION =
	"GitHub Copilot CLI runtime for local programmatic agent runs.";

export const GITHUB_COPILOT_DEFAULT_MODEL = "auto";

export const GITHUB_COPILOT_AVAILABLE_MODELS = [
	{
		id: "auto",
		label: "Auto",
		description: "Let GitHub Copilot CLI choose the model.",
		defaultFor: ["brainstorm", "taskIntake", "plan", "implement", "reviewTest"],
	},
] as const satisfies readonly AgentModelDefinition[];
