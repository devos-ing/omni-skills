export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh";

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
	runTaskIntake(prompt: string): Promise<AgentResult>;
	resume(sessionId: string, prompt: string): Promise<AgentResult>;
	runReview(prompt: string): Promise<AgentResult>;
	runGithubComment(prompt: string): Promise<AgentResult>;
}

export type AgentBackend = "codex" | "claude-code" | "cursor-agent";

export interface AgentAdapterRuntimeConfig {
	workspacePath: string;
	executionPath: string;
	codex: {
		binary: string;
		streamLogs: boolean;
		model?: string;
		reasoningEffort?: CodexReasoningEffort;
		models?: {
			plan?: string;
			implement?: string;
			reviewTest?: string;
			githubComment?: string;
		};
		reasoningEfforts?: {
			plan?: CodexReasoningEffort;
			implement?: CodexReasoningEffort;
			reviewTest?: CodexReasoningEffort;
			githubComment?: CodexReasoningEffort;
		};
		fastModes?: {
			plan?: boolean;
			implement?: boolean;
			reviewTest?: boolean;
			githubComment?: boolean;
		};
		plugins?: string[];
		skillsets?: string[];
		configOverrides?: Record<string, string>;
		sandbox?: "read-only" | "workspace-write" | "danger-full-access";
		codexHome?: string;
		docker?: {
			enabled?: boolean;
			image?: string;
			binary?: string;
			workspacePath?: string;
			executionPath?: string;
			codexHomePath?: string;
		};
	};
	cursor?: {
		binary: string;
		streamLogs: boolean;
		model?: string;
		force?: boolean;
		apiKey?: string;
	};
	claude?: {
		model?: string;
		maxTurns?: number;
		allowedTools?: string[];
		permissionMode?:
			| "default"
			| "acceptEdits"
			| "bypassPermissions"
			| "dontAsk"
			| "plan";
	};
	agent?: {
		backend?: AgentBackend;
		model?: string;
		maxTurns?: number;
		allowedTools?: string[];
		permissionMode?:
			| "default"
			| "acceptEdits"
			| "bypassPermissions"
			| "dontAsk"
			| "plan";
	};
}
