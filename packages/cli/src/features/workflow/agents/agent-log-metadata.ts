import type { AgentChatLogRole, ResolvedProjectConfig } from "../../types";

export function resolveAgentLogMetadata(
	config: ResolvedProjectConfig,
	agentRole: AgentChatLogRole,
) {
	return {
		agentBackend: config.agent?.backend ?? "codex",
		agentModel: resolveAgentModel(config, agentRole),
		phrase: agentRole,
	};
}

function resolveAgentModel(
	config: ResolvedProjectConfig,
	agentRole: AgentChatLogRole,
): string | undefined {
	if (!config.agent?.backend || config.agent.backend === "codex") {
		return resolveCodexModel(config, agentRole);
	}
	if (config.agent.model) return config.agent.model;
	if (config.agent.backend === "claude-code") return config.claude?.model;
	if (config.agent.backend === "cursor-agent") return config.cursor?.model;
	if (config.agent.backend === "opencode") return config.opencode?.model;
	return undefined;
}

function resolveCodexModel(
	config: ResolvedProjectConfig,
	agentRole: AgentChatLogRole,
): string | undefined {
	if (agentRole === "planning") {
		return config.codex.models?.plan ?? config.codex.model;
	}
	if (agentRole === "implementing") {
		return config.codex.models?.implement ?? config.codex.model;
	}
	if (agentRole === "github-comment") {
		return (
			config.codex.models?.githubComment ??
			config.codex.models?.reviewTest ??
			config.codex.models?.implement ??
			config.codex.model
		);
	}
	return (
		config.codex.models?.reviewTest ??
		config.codex.models?.implement ??
		config.codex.model
	);
}
