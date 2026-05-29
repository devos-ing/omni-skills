import type { CommandResult } from "../../../utils/shell";
import type { LoadedConfig, ResolvedEnv } from "../../config";
import type { PromptAdapter } from "../../prompts";
import type { CodexReasoningEffort } from "../../types";
import type { InstanceConfigLoadResult } from "./instance-config.types";

export interface OnboardDraft {
	workspaceName: string;
	workspacePath: string;
	executionPath: string;
	instance: OnboardInstanceDraft;
	notifications: {
		email: {
			enabled: boolean;
			resendApiKey?: string;
			from?: string;
			to: string[];
		};
	};
	workflow: {
		isolatedWorktrees: boolean;
	};
	statusMap: {
		backlog: string;
		assigned: string;
		plan: string;
		in_progress: string;
		in_review: string;
		canceled: string;
		failed: string;
		done: string;
	};
	labelMap: {
		pr_created: string;
		reviewing: string;
		testing: string;
	};
	codex: {
		reasoningEffort?: CodexReasoningEffort;
		reasoningEfforts?: {
			brainstorm?: CodexReasoningEffort;
			plan?: CodexReasoningEffort;
			implement?: CodexReasoningEffort;
			reviewTest?: CodexReasoningEffort;
			githubComment?: CodexReasoningEffort;
		};
		models: {
			brainstorm: string;
			plan: string;
			implement: string;
			reviewTest: string;
			githubComment: string;
		};
		plugins: string[];
		skillsets: string[];
		configOverrides: Record<string, string>;
		sandbox?: "read-only" | "workspace-write" | "danger-full-access";
	};
}

export interface OnboardInstanceDraft {
	database: {
		embeddedPostgresDataDir: string;
		embeddedPostgresPort: number;
		backup: {
			enabled: boolean;
			intervalMinutes: number;
			retentionDays: number;
			dir: string;
		};
	};
	logging: {
		logDir: string;
	};
	server: {
		port: number;
		allowedHostnames: string[];
		serveUi: boolean;
	};
	auth: {
		disableSignUp: boolean;
	};
	telemetry: {
		enabled: boolean;
	};
	storage: {
		localDiskBaseDir: string;
		s3: {
			bucket: string;
			region: string;
			prefix: string;
			forcePathStyle: boolean;
		};
	};
	secrets: {
		strictMode: boolean;
		keyFilePath: string;
	};
}

export interface OnboardCheck {
	name: string;
	status: "pass" | "fail";
	message: string;
}

export interface OnboardCheckDeps {
	loadConfig?: (cwd: string) => Promise<LoadedConfig>;
	loadResolvedEnv?: (cwd: string) => Promise<ResolvedEnv>;
	loadInstanceConfig?: (cwd: string) => Promise<InstanceConfigLoadResult>;
	runCommand?: (
		command: string,
		args: string[],
		options: { cwd: string },
	) => Promise<CommandResult>;
	access?: (targetPath: string) => Promise<void>;
	readFile?: (targetPath: string, encoding: BufferEncoding) => Promise<string>;
	mkdir?: (
		targetPath: string,
		options: { recursive: true },
	) => Promise<string | undefined>;
	canBindPort?: (host: string, port: number) => Promise<boolean>;
}

export interface GitHubDefaults {
	owner?: string;
	name?: string;
	baseBranch?: string;
}

export interface OnboardDraftPromptDeps {
	prompts: PromptAdapter;
	inferGitHubDefaults?: (cwd: string) => Promise<GitHubDefaults>;
}

export interface OnboardWizardDeps extends Partial<OnboardDraftPromptDeps> {
	runCommand?: OnboardCheckDeps["runCommand"];
	writeOnboardFiles?: (cwd: string, draft: OnboardDraft) => Promise<void>;
	collectOnboardChecks?: (cwd: string) => Promise<OnboardCheck[]>;
	configurePluginCredentials?: (
		cwd: string,
		prompts: PromptAdapter,
	) => Promise<void>;
}
