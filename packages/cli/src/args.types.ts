import type { RunOptions } from "./features/types";

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
};

export type CliCommand =
	| { kind: "run"; options: RunOptions }
	| { kind: "daemon" }
	| { kind: "status"; issueKey: string; projectId: string }
	| { kind: "projects" }
	| { kind: "skills"; command: SkillsCommand }
	| { kind: "task"; command: TaskCommand }
	| { kind: "setup"; check: boolean }
	| { kind: "help" };
