import type { AgentBackend } from "../agent-adapter.types";
import type { AgentModelDefinition } from "../agent-registry.types";

export const CLAUDE_BACKEND = "claude-code" satisfies AgentBackend;
export const CLAUDE_LABEL = "Claude Code";
export const CLAUDE_DESCRIPTION =
	"Anthropic Claude Code runtime for agent workflow stages.";

export const CLAUDE_DEFAULT_MODEL = "claude-sonnet-4-20250514";

export const CLAUDE_AVAILABLE_MODELS = [
	{
		id: "claude-sonnet-4-20250514",
		label: "Claude Sonnet 4",
		description: "Balanced Claude Code model for day-to-day agent work.",
		defaultFor: ["taskIntake", "plan", "implement", "reviewTest"],
	},
	{
		id: "claude-opus-4-20250514",
		label: "Claude Opus 4",
		description: "Higher-capability Claude Code model for complex work.",
	},
] as const satisfies readonly AgentModelDefinition[];
