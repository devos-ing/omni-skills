export type WorkflowStage =
	| "received"
	| "planning"
	| "implementing"
	| "pr_created"
	| "reviewing"
	| "testing"
	| "blocked"
	| "done"
	| "failed";

export interface LinearStatusMap {
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

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer U>
		? Array<DeepPartial<U>>
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

export interface ProjectRuntimeConfig {
	/**
	 * Root path used by piv-loop to persist run state and transient workflow files.
	 */
	workspacePath: string;
	/**
	 * Local repository path where codex/git/gh commands are executed.
	 */
	executionPath: string;
	repo: {
		owner: string;
		name: string;
		baseBranch: string;
	};
	linear: {
		apiKey: string;
		apiUrl: string;
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
	codex: {
		binary: string;
		model?: string;
		models?: {
			plan?: string;
			implement?: string;
			reviewTest?: string;
		};
		sandbox?: "read-only" | "workspace-write" | "danger-full-access";
		codexHome?: string;
	};
	skills: {
		plan: string;
		implement: string;
		reviewTest: string;
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
}

export type PivLoopRootConfig = DeepPartial<ProjectRuntimeConfig> & {
	polling?: DeepPartial<PollingConfig>;
	projects: ProjectConfig[];
};

export interface LinearIssue {
	id: string;
	identifier: string;
	title: string;
	url: string;
	priority: {
		value: number;
		name: string;
	};
	state: {
		id: string;
		name: string;
	};
	labels: Array<{
		id: string;
		name: string;
	}>;
}

export interface IssueRef {
	id: string;
	key: string;
	title: string;
	url: string;
}

export interface PullRequestRef {
	number?: number;
	url?: string;
	branch: string;
	title: string;
}

export interface BugRecord {
	title: string;
	body: string;
	issueUrl?: string;
}

export interface CodexUsageRecord {
	stage: "planning" | "implementing" | "testing";
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	recordedAt: string;
}

export interface RunState {
	projectId: string;
	projectName: string;
	workspacePath: string;
	repository: {
		owner: string;
		name: string;
		baseBranch: string;
	};
	issue: IssueRef;
	stage: WorkflowStage;
	codexSessionId?: string;
	reviewSessionId?: string;
	planSummary?: string;
	implementationSummary?: string;
	reviewSummary?: string;
	testingSummary?: string;
	pullRequest?: PullRequestRef;
	bugs: BugRecord[];
	codexUsage?: CodexUsageRecord[];
	startedAt: string;
	updatedAt: string;
	lastError?: string;
}

export interface RunOptions {
	issueArg?: string;
	projectId?: string;
	allProjects?: boolean;
	poll?: boolean;
	pollIntervalMs?: number;
	maxPollCycles?: number;
	exitWhenIdle?: boolean;
}
