import type { ResolvedProjectConfig } from "../core/types";
import type { AgentAdapter, AgentBackend } from "./types";
export type { AgentAdapter, AgentBackend, AgentResult } from "./types";

export function createAgentAdapter(
	config: ResolvedProjectConfig,
	backend?: AgentBackend,
): AgentAdapter {
	const resolvedBackend = backend ?? config.agent?.backend ?? "codex";

	switch (resolvedBackend) {
		case "codex": {
			const { CodexAdapter } = require("./codex");
			return new CodexAdapter(config);
		}
		case "claude-code": {
			const { ClaudeCodeAdapter } = require("./claude-code");
			return new ClaudeCodeAdapter(config);
		}
		default:
			throw new Error(`Unknown agent backend: ${resolvedBackend}`);
	}
}
