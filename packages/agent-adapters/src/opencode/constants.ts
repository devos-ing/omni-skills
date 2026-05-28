import type { AgentBackend } from "../types/agent-adapter.types";
import type { AgentModelDefinition } from "../types/agent-registry.types";

export const OPENCODE_BACKEND = "opencode" satisfies AgentBackend;
export const OPENCODE_LABEL = "OpenCode";
export const OPENCODE_DESCRIPTION =
	"OpenCode CLI runtime for local and OpenAI-compatible agent models.";

export const OPENCODE_DEFAULT_MODEL = "ollama/qwen2.5-coder:32b";

export const OPENCODE_AVAILABLE_MODELS = [
	{
		id: "ollama/qwen2.5-coder:32b",
		label: "Qwen 2.5 Coder 32B (Ollama)",
		description: "Local Qwen coder model served by Ollama.",
		defaultFor: ["taskIntake", "plan", "implement", "reviewTest"],
	},
	{
		id: "lmstudio/google/gemma-3n-e4b",
		label: "Gemma 3n E4B (LM Studio)",
		description: "Local Gemma model served by LM Studio.",
	},
] as const satisfies readonly AgentModelDefinition[];
