import type { LoadedConfig } from "./features/config";
import type { PluginsCommand } from "./features/plugins";
import type { RunOptions } from "./features/types";

export type CliParseOutput = {
	writeOut?: (message: string) => void;
	writeErr?: (message: string) => void;
};

export type RunCommanderOptions = {
	issue?: string;
	project?: string;
	allProjects?: boolean;
	poll?: boolean;
	pollForever?: boolean;
	exitWhenIdle?: boolean;
	concurrency?: number;
	pollIntervalMs?: number;
	maxPollCycles?: number;
	isolatedWorktrees?: boolean;
};

export type OnboardCommanderOptions = {
	check?: boolean;
};

export type ProjectCommanderOptions = {
	project?: string;
};

export type PluginListCommanderOptions = {
	enabled?: boolean;
};

export type PluginCreateCommanderOptions = {
	template?: "skill" | "mcp" | "connector";
	preset?: "codegraph" | "slack" | "telegram";
	output?: string;
	displayName?: string;
	description?: string;
	author?: string;
	force?: boolean;
	json?: boolean;
};

export type StatusCommanderOptions = ProjectCommanderOptions & {
	issue?: string;
};

export type SkillAddCommanderOptions = ProjectCommanderOptions & {
	title: string;
	description: string;
	content: string;
};

export type SkillUpdateCommanderOptions = ProjectCommanderOptions & {
	title?: string;
	description?: string;
	content?: string;
};

export type TaskCreateCommanderOptions = ProjectCommanderOptions & {
	request?: string;
	nonInteractive?: boolean;
	maxClarificationRounds?: number;
	clarificationsJson?: Array<{ question: string; answer: string }>;
	json?: boolean;
};

export type SkillsCommand =
	| { action: "list"; projectId?: string }
	| {
			action: "add";
			projectId?: string;
			title: string;
			description: string;
			content: string;
	  }
	| {
			action: "update";
			projectId?: string;
			name: string;
			title?: string;
			description?: string;
			content?: string;
	  }
	| {
			action: "remove";
			projectId?: string;
			name: string;
	  };

export type TaskCommand = {
	action: "create";
	projectId?: string;
	request?: string;
	nonInteractive?: boolean;
	maxClarificationRounds?: number;
	clarificationAnswers?: Array<{ question: string; answer: string }>;
	json?: boolean;
};

export type OnboardCommand = { check: boolean };

export type DaemonCommand = Record<string, never>;

export type WorkflowWorkerCommand = Record<string, never>;

export type StatusCommand = {
	issueKey: string;
	projectId: string;
};

export type CliRuntime = {
	cwd: string;
	loadConfig(): Promise<LoadedConfig>;
	handleOnboardCommand(command: OnboardCommand, cwd: string): Promise<void>;
	runProductionDaemon(options: { cwd: string }): Promise<number>;
	runWorkflowCommandWorker(options: { cwd: string }): Promise<number>;
	handleRunCommand(config: LoadedConfig, options: RunOptions): Promise<void>;
	handleStatusCommand(
		config: LoadedConfig,
		command: StatusCommand,
	): Promise<void>;
	handleSkillsCommand(
		config: LoadedConfig,
		command: SkillsCommand,
	): Promise<void>;
	handlePluginsCommand(
		config: LoadedConfig,
		command: PluginsCommand,
		cwd: string,
	): Promise<void>;
	handleTaskCommand(config: LoadedConfig, command: TaskCommand): Promise<void>;
};

export type { PluginsCommand };
