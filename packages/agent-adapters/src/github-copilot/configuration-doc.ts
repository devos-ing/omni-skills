import type { AgentConfigurationDoc } from "../types/agent-registry.types";
import {
	GITHUB_COPILOT_AVAILABLE_MODELS,
	GITHUB_COPILOT_BACKEND,
	GITHUB_COPILOT_DEFAULT_MODEL,
	GITHUB_COPILOT_DESCRIPTION,
	GITHUB_COPILOT_LABEL,
} from "./constants";

export const githubCopilotConfigurationDoc = {
	backend: GITHUB_COPILOT_BACKEND,
	label: GITHUB_COPILOT_LABEL,
	description: GITHUB_COPILOT_DESCRIPTION,
	env: [
		field(
			"AGENT_BACKEND",
			"Agent backend",
			"Use 'github-copilot' for GitHub Copilot CLI.",
		),
		field("GITHUB_COPILOT_BINARY", "Binary", "GitHub Copilot CLI binary path."),
		field("GITHUB_COPILOT_MODEL", "Model", "GitHub Copilot CLI model id."),
		field("GITHUB_COPILOT_HOME", "Home", "GitHub Copilot CLI home directory."),
		field(
			"GITHUB_COPILOT_TOKEN",
			"Token",
			"GitHub Copilot CLI authentication token.",
		),
		field(
			"GITHUB_COPILOT_ALLOW_ALL_TOOLS",
			"Allow all tools",
			"Allow GitHub Copilot CLI to use all tools.",
		),
		field(
			"GITHUB_COPILOT_ALLOW_TOOLS",
			"Allow tools",
			"Comma-separated GitHub Copilot CLI tool allow patterns.",
		),
		field(
			"GITHUB_COPILOT_DENY_TOOLS",
			"Deny tools",
			"Comma-separated GitHub Copilot CLI tool deny patterns.",
		),
	],
	configFields: [
		field("agent.backend", "Agent backend", "Project agent backend."),
		field("githubCopilot.binary", "Binary", "GitHub Copilot CLI binary path."),
		field("githubCopilot.model", "Model", "GitHub Copilot CLI model id."),
		field("githubCopilot.copilotHome", "Home", "GitHub Copilot CLI home."),
		field("githubCopilot.githubToken", "Token", "GitHub Copilot token."),
		field(
			"githubCopilot.allowAllTools",
			"Allow all tools",
			"Allow GitHub Copilot CLI to use all tools.",
		),
		field(
			"githubCopilot.allowTools",
			"Allow tools",
			"GitHub Copilot CLI tool allow patterns.",
		),
		field(
			"githubCopilot.denyTools",
			"Deny tools",
			"GitHub Copilot CLI tool deny patterns.",
		),
	],
	defaults: {
		backend: GITHUB_COPILOT_BACKEND,
		model: GITHUB_COPILOT_DEFAULT_MODEL,
	},
	availableModels: GITHUB_COPILOT_AVAILABLE_MODELS,
} satisfies AgentConfigurationDoc;

function field(
	name: string,
	label: string,
	description: string,
): AgentConfigurationDoc["env"][number] {
	return { name, label, description };
}
