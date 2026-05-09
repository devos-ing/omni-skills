import type { ResolvedProjectConfig } from "../core/types";

export interface AgentResult {
	sessionId?: string;
	finalMessage: string;
	stdout: string;
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
	};
}

export interface AgentAdapter {
	runPlan(prompt: string): Promise<AgentResult>;
	resume(sessionId: string, prompt: string): Promise<AgentResult>;
	runReview(prompt: string): Promise<AgentResult>;
}

export type AgentBackend = "codex" | "claude-code";

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
