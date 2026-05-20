import type { CodexReasoningEffort } from "../../features/types";
import type { CommandResult } from "../../utils/shell";
import type { LoadedConfig, ResolvedEnv } from "../config";
import type { PromptAdapter } from "../prompts";
import type { InstanceConfigLoadResult } from "./instance-config.types";

export interface SetupDraft {
	projectId: string;
	projectName: string;
	projectDescription: string;
	workspacePath: string;
	executionPath: string;
	repoOwner: string;
	repoName: string;
	baseBranch: string;
	lead: string;
	category: string;
	priority: number | null;
	linearApiKey: string;
	linearProjectId?: string;
	linearTeamId?: string;
	notifications: {
		email: {
			enabled: boolean;
			resendApiKey?: string;
			from?: string;
			to: string[];
		};
	};
	statusMap: {
		backlog: string;
		assigned: string;
		planning: string;
		implementing: string;
		pr_created: string;
		reviewing: string;
		testing: string;
		blocked: string;
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
			plan?: CodexReasoningEffort;
			implement?: CodexReasoningEffort;
			reviewTest?: CodexReasoningEffort;
			githubComment?: CodexReasoningEffort;
		};
		models: {
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

export interface SetupCheck {
	name: string;
	status: "pass" | "fail";
	message: string;
}

export interface SetupCheckDeps {
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

export interface SetupDraftPromptDeps {
	prompts: PromptAdapter;
	inferGitHubDefaults?: (cwd: string) => Promise<GitHubDefaults>;
}

export interface SetupWizardDeps extends Partial<SetupDraftPromptDeps> {
	runCommand?: SetupCheckDeps["runCommand"];
	writeSetupFiles?: (cwd: string, draft: SetupDraft) => Promise<void>;
	collectSetupChecks?: (cwd: string) => Promise<SetupCheck[]>;
}
