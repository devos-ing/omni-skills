import type { AgentConfigurationDoc } from "../agent-registry.types";
import {
	CLAUDE_AVAILABLE_MODELS,
	CLAUDE_BACKEND,
	CLAUDE_DEFAULT_MODEL,
	CLAUDE_DESCRIPTION,
	CLAUDE_LABEL,
} from "./constants";

export const claudeConfigurationDoc = {
	backend: CLAUDE_BACKEND,
	label: CLAUDE_LABEL,
	description: CLAUDE_DESCRIPTION,
	env: [
		field(
			"AGENT_BACKEND",
			"Agent backend",
			"Use 'claude-code' for Claude Code.",
		),
		field("CLAUDE_CODE_MODEL", "Model", "Claude Code model id."),
		field(
			"CLAUDE_CODE_MAX_TURNS",
			"Max turns",
			"Maximum Claude Code turns per invocation.",
		),
		field(
			"CLAUDE_CODE_ALLOWED_TOOLS",
			"Allowed tools",
			"Comma-separated Claude Code tool allowlist.",
		),
		field(
			"CLAUDE_CODE_PERMISSION_MODE",
			"Permission mode",
			"Claude Code permission mode.",
		),
	],
	configFields: [
		field("agent.backend", "Agent backend", "Project agent backend."),
		field("claude.model", "Model", "Claude Code model id."),
		field("claude.maxTurns", "Max turns", "Maximum turns per invocation."),
		field(
			"claude.allowedTools",
			"Allowed tools",
			"Claude Code tool allowlist.",
		),
		field("claude.permissionMode", "Permission mode", "Permission mode."),
		field(
			"agent.model",
			"Deprecated model fallback",
			"Deprecated Claude fallback; use claude.model.",
		),
		field(
			"agent.maxTurns",
			"Deprecated max turns fallback",
			"Deprecated Claude fallback; use claude.maxTurns.",
		),
		field(
			"agent.allowedTools",
			"Deprecated tools fallback",
			"Deprecated Claude fallback; use claude.allowedTools.",
		),
		field(
			"agent.permissionMode",
			"Deprecated permission fallback",
			"Deprecated Claude fallback; use claude.permissionMode.",
		),
	],
	defaults: {
		backend: CLAUDE_BACKEND,
		model: CLAUDE_DEFAULT_MODEL,
	},
	availableModels: CLAUDE_AVAILABLE_MODELS,
} satisfies AgentConfigurationDoc;

function field(
	name: string,
	label: string,
	description: string,
): AgentConfigurationDoc["env"][number] {
	return { name, label, description };
}
