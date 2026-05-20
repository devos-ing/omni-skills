import type { AgentBackend } from "../agent-adapter.types";
import type { AgentModelDefinition } from "../agent-registry.types";

export const CURSOR_BACKEND = "cursor-agent" satisfies AgentBackend;
export const CURSOR_LABEL = "Cursor Agent";
export const CURSOR_DESCRIPTION =
	"Cursor Agent CLI runtime for agent workflow stages.";

export const CURSOR_DEFAULT_MODEL = "auto";

export const CURSOR_AVAILABLE_MODELS = [
	{
		id: "auto",
		label: "Auto",
		description: "Let Cursor choose the model for the current task.",
		defaultFor: ["taskIntake", "plan", "implement", "reviewTest"],
	},
] as const satisfies readonly AgentModelDefinition[];
