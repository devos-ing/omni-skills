import type { AgentBackend } from "../types/agent-adapter.types";
import type {
	AgentModelDefinition,
	AgentStage,
} from "../types/agent-registry.types";

export const CODEX_BACKEND = "codex" satisfies AgentBackend;
export const CODEX_LABEL = "Codex";
export const CODEX_DESCRIPTION =
	"OpenAI Codex runtime for planning, implementation, review, and GitHub comment stages.";

export const CODEX_DEFAULT_MODEL = "gpt-5.5";

export const CODEX_DEFAULT_STAGE_MODELS = {
	brainstorm: "gpt-5.5",
	plan: "gpt-5.5",
	implement: "gpt-5.3-codex",
	reviewTest: "gpt-5.3-codex",
	githubComment: "gpt-5.4-mini",
} satisfies Partial<Record<AgentStage, string>>;

export const CODEX_AVAILABLE_MODELS = [
	model("gpt-5", "GPT-5", "General OpenAI coding model."),
	model("gpt-5.1", "GPT-5.1", "Newer general OpenAI coding model."),
	model(
		"gpt-5.3-codex",
		"GPT-5.3 Codex",
		"Codex-optimized implementation and review model.",
		["implement", "reviewTest"],
	),
	model("gpt-5.4", "GPT-5.4", "Balanced OpenAI coding model."),
	model(
		"gpt-5.4-mini",
		"GPT-5.4 Mini",
		"Lower-latency OpenAI model for lightweight agent tasks.",
		["githubComment"],
	),
	model("gpt-5.5", "GPT-5.5", "Frontier OpenAI planning model.", [
		"brainstorm",
		"plan",
	]),
] as const satisfies readonly AgentModelDefinition[];

function model(
	id: string,
	label: string,
	description: string,
	defaultFor?: readonly AgentStage[],
): AgentModelDefinition {
	return { id, label, description, defaultFor };
}
