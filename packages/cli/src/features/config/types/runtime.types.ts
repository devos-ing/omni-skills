import type { ServerRuntimeConfig } from "./server.types";

export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface WorkflowRuntimeConfig {
	issueConcurrency: number;
	isolatedWorktrees?: {
		enabled: boolean;
		root?: string;
	};
}

export interface McpServerRuntimeConfig {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
}

export interface ModelTokenPricingConfig {
	inputUsdPerMillion: number;
	outputUsdPerMillion: number;
}

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer U>
		? Array<DeepPartial<U>>
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

export interface ProjectRuntimeConfig {
	workspacePath: string;
	executionPath: string;
	repo: {
		owner: string;
		name: string;
		baseBranch: string;
	};
	github: {
		useGhCli: boolean;
		defaultBugLabel: string;
	};
	server: ServerRuntimeConfig;
	usage?: {
		pricing: {
			models: Record<string, ModelTokenPricingConfig>;
		};
	};
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
		mcpServers?: McpServerRuntimeConfig[];
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
		backend?: "codex" | "claude-code" | "cursor-agent" | "opencode";
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
	workflow: WorkflowRuntimeConfig;
	skills: {
		root: string;
		brainstorm: string;
		plan: string;
		implement: string;
		reviewTest: string;
		githubComment: string;
		createTask?: string;
		autoSelect?: {
			enabled: boolean;
			sources: {
				folder: boolean;
				database: boolean;
			};
			databasePath?: string;
			maxSelected: number;
		};
		pluginSkillPaths?: string[];
	};
	dryRun: boolean;
}

export interface ProjectConfig extends Partial<ProjectRuntimeConfig> {
	id: string;
	name?: string;
}

export interface ResolvedProjectConfig extends ProjectRuntimeConfig {
	id: string;
	name: string;
}

export interface PollingConfig {
	intervalMs: number;
	maxCycles?: number;
	exitWhenIdle: boolean;
	staleRunTimeoutMs: number;
}

export interface NotificationEmailConfig {
	enabled?: boolean;
	resendApiKey?: string;
	from?: string;
	to?: string[];
}

export interface NotificationConfig {
	email?: NotificationEmailConfig;
}

export interface ResolvedNotificationEmailConfig {
	enabled: boolean;
	resendApiKey?: string;
	from?: string;
	to: string[];
}

export interface ResolvedNotificationConfig {
	email: ResolvedNotificationEmailConfig;
}

export type DevosRootConfig = DeepPartial<ProjectRuntimeConfig> & {
	polling?: DeepPartial<PollingConfig>;
	notifications?: DeepPartial<NotificationConfig>;
	projects: ProjectConfig[];
};

export type PivLoopRootConfig = DevosRootConfig;
