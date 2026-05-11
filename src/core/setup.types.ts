import type { CommandResult } from "../utils/shell";
import type { LoadedConfig } from "./config";
import type { CodexReasoningEffort } from "./types";

export interface SetupDraft {
	projectId: string;
	projectName: string;
	workspacePath: string;
	executionPath: string;
	repoOwner: string;
	repoName: string;
	baseBranch: string;
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
		};
		models: {
			plan: string;
			implement: string;
			reviewTest: string;
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
	runCommand?: (
		command: string,
		args: string[],
		options: { cwd: string },
	) => Promise<CommandResult>;
	access?: (targetPath: string) => Promise<void>;
	readFile?: (targetPath: string, encoding: BufferEncoding) => Promise<string>;
}

export interface GitHubDefaults {
	owner?: string;
	name?: string;
	baseBranch?: string;
}
