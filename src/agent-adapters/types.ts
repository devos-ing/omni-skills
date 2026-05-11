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
