import type { AgentConfigurationDoc } from "../../types/agent-registry.types";
import {
	CODEX_AVAILABLE_MODELS,
	CODEX_BACKEND,
	CODEX_DEFAULT_MODEL,
	CODEX_DEFAULT_STAGE_MODELS,
	CODEX_DESCRIPTION,
	CODEX_LABEL,
} from "../constants";

export const codexConfigurationDoc = {
	backend: CODEX_BACKEND,
	label: CODEX_LABEL,
	description: CODEX_DESCRIPTION,
	env: [
		field("AGENT_BACKEND", "Agent backend", "Use 'codex' for Codex."),
		field("CODEX_MODEL", "Default model", "Fallback Codex model."),
		field(
			"CODEX_MODEL_BRAINSTORM",
			"Brainstorm model",
			"Brainstorm stage model.",
		),
		field("CODEX_MODEL_PLAN", "Planning model", "Planning stage model."),
		field(
			"CODEX_MODEL_IMPLEMENT",
			"Implementation model",
			"Implementation stage model.",
		),
		field(
			"CODEX_MODEL_REVIEW_TEST",
			"Review/testing model",
			"Review and testing stage model.",
		),
		field(
			"CODEX_MODEL_GITHUB_COMMENT",
			"GitHub comment model",
			"Pull request comment drafting model.",
		),
	],
	configFields: [
		field("agent.backend", "Agent backend", "Project agent backend."),
		field("codex.model", "Default model", "Fallback Codex model."),
		field(
			"codex.models.brainstorm",
			"Brainstorm model",
			"Brainstorm stage model.",
		),
		field("codex.models.plan", "Planning model", "Planning stage model."),
		field(
			"codex.models.implement",
			"Implementation model",
			"Implementation stage model.",
		),
		field(
			"codex.models.reviewTest",
			"Review/testing model",
			"Review and testing stage model.",
		),
		field(
			"codex.models.githubComment",
			"GitHub comment model",
			"Pull request comment drafting model.",
		),
	],
	defaults: {
		backend: CODEX_BACKEND,
		model: CODEX_DEFAULT_MODEL,
		models: CODEX_DEFAULT_STAGE_MODELS,
	},
	availableModels: CODEX_AVAILABLE_MODELS,
} satisfies AgentConfigurationDoc;

function field(
	name: string,
	label: string,
	description: string,
): AgentConfigurationDoc["env"][number] {
	return { name, label, description };
}
