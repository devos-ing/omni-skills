export type CliCommandStreamRequest =
	| RunCliCommandStreamRequest
	| StatusCliCommandStreamRequest
	| OnboardCliCommandStreamRequest
	| SkillsCliCommandStreamRequest
	| TaskCliCommandStreamRequest;

export type SupportedWorkflowCommandRequest = CliCommandStreamRequest;

export interface RunCliCommandStreamRequest {
	action: "run";
	projectId?: string;
	issueKey?: string;
	allProjects?: boolean;
	poll?: boolean;
	pollForever?: boolean;
	noExitWhenIdle?: boolean;
	concurrency?: number;
	pollIntervalMs?: number;
	maxPollCycles?: number;
	isolatedWorktrees?: boolean;
}

export interface StatusCliCommandStreamRequest {
	action: "status";
	projectId: string;
	issueKey: string;
}

export interface OnboardCliCommandStreamRequest {
	action: "onboard";
	check?: boolean;
}

export type SkillsCliCommandStreamRequest =
	| {
			action: "skills";
			skillsAction: "list";
			projectId?: string;
	  }
	| {
			action: "skills";
			skillsAction: "add";
			projectId?: string;
			title: string;
			description: string;
			content: string;
	  }
	| {
			action: "skills";
			skillsAction: "update";
			projectId?: string;
			name: string;
			title?: string;
			description?: string;
			content?: string;
	  }
	| {
			action: "skills";
			skillsAction: "remove";
			projectId?: string;
			name: string;
	  };

export interface TaskCliCommandStreamRequest {
	action: "task";
	taskAction: "create";
	projectId?: string;
	request: string;
	nonInteractive?: true;
	maxClarificationRounds?: number;
	clarificationAnswers?: Array<{ question: string; answer: string }>;
	json?: boolean;
}

export interface WorkflowProgressEvent {
	schema?: string;
	emittedAt?: string;
	kind?: string;
	projectId?: string;
	issueKey?: string;
	stage?: string;
	action?: string;
	status?: string;
	stream?: string;
	level?: string;
	message?: string;
	detail?: string;
	error?: string;
	[key: string]: unknown;
}

export type CliCommandStreamEvent =
	| {
			type: "start";
			request: CliCommandStreamRequest;
			invocation: { command: string; args: string[] };
	  }
	| { type: "stdout"; text: string }
	| { type: "stderr"; text: string }
	| { type: "progress"; event: WorkflowProgressEvent }
	| { type: "error"; error: string }
	| {
			type: "complete";
			result: {
				status: "succeeded" | "failed" | "rejected";
				request: CliCommandStreamRequest;
				invocation?: { command: string; args: string[] };
				commandResult?: { code: number; stdout: string; stderr: string };
				error?: string;
			};
	  };

export type CliCommandStreamHandler = (event: CliCommandStreamEvent) => void;
