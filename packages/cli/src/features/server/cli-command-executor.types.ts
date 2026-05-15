import type { CommandResult } from "../../utils/shell";

export type SupportedCliAction =
	| "run"
	| "status"
	| "projects"
	| "setup"
	| "skills"
	| "task";

export interface RunActionRequest {
	action: "run";
	projectId?: string;
	issueKey?: string;
	allProjects?: boolean;
	poll?: boolean;
	noExitWhenIdle?: boolean;
	concurrency?: number;
	pollIntervalMs?: number;
	maxPollCycles?: number;
	isolatedWorktrees?: boolean;
}

export interface StatusActionRequest {
	action: "status";
	projectId: string;
	issueKey: string;
}

export interface ProjectsActionRequest {
	action: "projects";
}

export interface SetupActionRequest {
	action: "setup";
	check?: boolean;
}

export interface SkillsListActionRequest {
	action: "skills";
	skillsAction: "list";
	projectId?: string;
}

export interface SkillsAddActionRequest {
	action: "skills";
	skillsAction: "add";
	projectId?: string;
	title: string;
	description: string;
	content: string;
}

export interface SkillsUpdateActionRequest {
	action: "skills";
	skillsAction: "update";
	projectId?: string;
	name: string;
	title?: string;
	description?: string;
	content?: string;
}

export interface SkillsRemoveActionRequest {
	action: "skills";
	skillsAction: "remove";
	projectId?: string;
	name: string;
}

export type SkillsActionRequest =
	| SkillsListActionRequest
	| SkillsAddActionRequest
	| SkillsUpdateActionRequest
	| SkillsRemoveActionRequest;

export interface TaskCreateActionRequest {
	action: "task";
	taskAction: "create";
	projectId?: string;
	request: string;
	nonInteractive?: boolean;
	maxClarificationRounds?: number;
	clarificationAnswers?: Array<{ question: string; answer: string }>;
}

export type SupportedCliCommandRequest =
	| RunActionRequest
	| StatusActionRequest
	| ProjectsActionRequest
	| SetupActionRequest
	| SkillsActionRequest
	| TaskCreateActionRequest;

export type CliCommandRequest =
	| SupportedCliCommandRequest
	| {
			action: string;
			[key: string]: unknown;
	  };

export interface CliCommandInvocation {
	command: string;
	args: string[];
}

export interface CliCommandExecutionHistoryEntry {
	requestedAt: string;
	finishedAt: string;
	request: CliCommandRequest;
	status: "succeeded" | "failed" | "rejected";
	command?: string;
	args?: string[];
	exitCode?: number;
	stdout?: string;
	stderr?: string;
	error?: string;
}

export interface CliCommandExecutionResult {
	status: "succeeded" | "failed" | "rejected";
	request: CliCommandRequest;
	invocation?: CliCommandInvocation;
	commandResult?: CommandResult;
	error?: string;
}

export type CliCommandStreamEvent =
	| {
			type: "start";
			request: CliCommandRequest;
			invocation: CliCommandInvocation;
	  }
	| { type: "stdout"; text: string }
	| { type: "stderr"; text: string }
	| { type: "error"; error: string }
	| { type: "complete"; result: CliCommandExecutionResult };

export type CliCommandStreamEmit = (event: CliCommandStreamEvent) => void;

export type RunCommandFn = (
	command: string,
	args: string[],
	options: {
		cwd: string;
		env?: NodeJS.ProcessEnv;
		stdinMode?: "pipe" | "ignore" | "inherit";
		streamStdout?: boolean;
		streamStderr?: boolean;
		onStdout?: (text: string) => void;
		onStderr?: (text: string) => void;
	},
) => Promise<CommandResult>;

export interface CliCommandExecutorOptions {
	cwd: string;
	command: string;
	baseArgs: string[];
	env?: NodeJS.ProcessEnv;
	maxHistoryEntries?: number;
	runCommandFn?: RunCommandFn;
}
