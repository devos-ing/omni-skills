import type { ServerRuntimeConfig } from "./server.types";

export interface LinearStatusMap {
	backlog: string;
	assigned: string;
	planning: string;
	implementing: string;
	pr_created: string;
	reviewing: string;
	testing: string;
	blocked: string;
	done: string;
}

export interface LinearLabelMap {
	pr_created?: string;
	reviewing?: string;
	testing?: string;
}

export type CodexReasoningEffort = "low" | "medium" | "high" | "xhigh";

export interface WorkflowRuntimeConfig {
	issueConcurrency: number;
	isolatedWorktrees?: {
		enabled: boolean;
		root?: string;
	};
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
	linear: {
		apiKey: string;
		apiUrl: string;
		projectId?: string;
		teamId?: string;
		requiredLabel?: string;
		pollLimit: number;
		statusMap: LinearStatusMap;
		labelMap: LinearLabelMap;
		autoCreateLabels: boolean;
	};
	github: {
		useGhCli: boolean;
		defaultBugLabel: string;
	};
	server: ServerRuntimeConfig;
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
	agent?: {
		backend?: "codex" | "claude-code";
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

export type AdhdAiRootConfig = DeepPartial<ProjectRuntimeConfig> & {
	polling?: DeepPartial<PollingConfig>;
	notifications?: DeepPartial<NotificationConfig>;
	projects: ProjectConfig[];
};

export type PivLoopRootConfig = AdhdAiRootConfig;
