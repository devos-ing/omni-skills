import type {
	AgentDescriptor,
	AgentSkillReference,
	AgentStreamEvent,
	AgentTokenUsage,
} from "devos-agents";

export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface AgentResult {
	sessionId?: string;
	finalMessage: string;
	stdout: string;
	stderr?: string;
	traceId?: string;
	backend?: AgentBackend;
	usage?: AgentTokenUsage;
}

export type AgentAdapterRunRole =
	| "brainstorm"
	| "planning"
	| "task-intake"
	| "implementing"
	| "review-testing"
	| "github-comment";

export interface AgentAdapterRunRequest {
	role: AgentAdapterRunRole;
	prompt: string;
	sessionId?: string;
	traceId?: string;
	agent?: AgentDescriptor;
	customInstructions?: string;
	skills?: AgentSkillReference[];
	skillsets?: string[];
	onStream?: (event: AgentStreamEvent) => void;
}

export interface AgentAdapter {
	runAgent?(request: AgentAdapterRunRequest): Promise<AgentResult>;
	runPlan(prompt: string): Promise<AgentResult>;
	runTaskIntake(prompt: string): Promise<AgentResult>;
	resume(sessionId: string, prompt: string): Promise<AgentResult>;
	runReview(prompt: string): Promise<AgentResult>;
	runGithubComment(prompt: string): Promise<AgentResult>;
}

export type AgentBackend =
	| "codex"
	| "claude-code"
	| "github-copilot"
	| "cursor-agent"
	| "opencode";

export interface AgentMcpServerRuntimeConfig {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
}

export interface AgentAdapterRuntimeConfig {
	workspacePath: string;
	executionPath: string;
	codex: {
		binary: string;
		streamLogs: boolean;
		model?: string;
		reasoningEffort?: CodexReasoningEffort;
		models?: {
			brainstorm?: string;
			plan?: string;
			implement?: string;
			reviewTest?: string;
			githubComment?: string;
		};
		reasoningEfforts?: {
			brainstorm?: CodexReasoningEffort;
			plan?: CodexReasoningEffort;
			implement?: CodexReasoningEffort;
			reviewTest?: CodexReasoningEffort;
			githubComment?: CodexReasoningEffort;
		};
		fastModes?: {
			brainstorm?: boolean;
			plan?: boolean;
			implement?: boolean;
			reviewTest?: boolean;
			githubComment?: boolean;
		};
		plugins?: string[];
		skillsets?: string[];
		mcpServers?: AgentMcpServerRuntimeConfig[];
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
	opencode?: {
		binary: string;
		streamLogs: boolean;
		model?: string;
		agent?: string;
		attach?: string;
		dangerouslySkipPermissions?: boolean;
	};
	githubCopilot?: {
		binary: string;
		streamLogs: boolean;
		model?: string;
		copilotHome?: string;
		githubToken?: string;
		allowAllTools?: boolean;
		allowTools?: string[];
		denyTools?: string[];
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
