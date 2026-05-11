export type WorkflowStage =
	| "received"
	| "planning"
	| "implementing"
	| "pr_created"
	| "reviewing"
	| "testing"
	| "human_review"
	| "blocked"
	| "done"
	| "failed";

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

export type DeepPartial<T> = {
	[K in keyof T]?: T[K] extends Array<infer U>
		? Array<DeepPartial<U>>
		: T[K] extends object
			? DeepPartial<T[K]>
			: T[K];
};

export interface ProjectRuntimeConfig {
	/**
	 * Root path used by ADHD.ai to persist run state and transient workflow files.
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
	codex: {
		binary: string;
		streamLogs: boolean;
		model?: string;
		reasoningEffort?: CodexReasoningEffort;
		models?: {
			plan?: string;
			implement?: string;
			reviewTest?: string;
		};
		reasoningEfforts?: {
			plan?: CodexReasoningEffort;
			implement?: CodexReasoningEffort;
			reviewTest?: CodexReasoningEffort;
		};
		fastModes?: {
			plan?: boolean;
			implement?: boolean;
			reviewTest?: boolean;
		};
		plugins?: string[];
		skillsets?: string[];
		/**
		 * Raw Codex CLI -c overrides in key -> TOML value format, e.g.
		 * { "features.experimental": "true", "foo.bar": "\"baz\"" }.
		 */
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
	skills: {
		root: string;
		plan: string;
		implement: string;
		reviewTest: string;
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

export type CronScheduleDayOfWeek =
	| "sun"
	| "mon"
	| "tue"
	| "wed"
	| "thu"
	| "fri"
	| "sat";

export type CronJobSchedule =
	| {
			frequency: "minute";
			every?: number;
	  }
	| {
			frequency: "hourly";
			every?: number;
			minute?: number;
	  }
	| {
			frequency: "daily";
			time: string;
	  }
	| {
			frequency: "weekly";
			dayOfWeek: CronScheduleDayOfWeek;
			time: string;
	  };

export interface CronJobSkillOverrides {
	plan?: string;
	implement?: string;
	reviewTest?: string;
}

export interface CronJobConfig {
	id: string;
	name?: string;
	enabled?: boolean;
	schedule: CronJobSchedule;
	run: RunOptions;
	skills?: CronJobSkillOverrides;
}

export interface CronConfig {
	jobs: CronJobConfig[];
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
	automations?: DeepPartial<CronConfig>;
	cron?: DeepPartial<CronConfig>;
	notifications?: DeepPartial<NotificationConfig>;
	projects: ProjectConfig[];
};

export type PivLoopRootConfig = AdhdAiRootConfig;

export interface LinearIssue {
	id: string;
	identifier: string;
	title: string;
	description?: string;
	url: string;
	projectId?: string;
	teamId?: string;
	creatorId?: string;
	assigneeId?: string;
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
	description?: string;
	url: string;
	projectId?: string;
	teamId?: string;
	creatorId?: string;
	assigneeId?: string;
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

export interface PlannedSplitTask {
	title: string;
	description?: string;
	labels?: string[];
	priority?: number;
}

export interface SplitTaskRef {
	title: string;
	issueKey?: string;
	issueUrl?: string;
}

export interface CodexUsageRecord {
	stage: "planning" | "implementing" | "testing";
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
	recordedAt: string;
}

export type AgentChatLogRole = "planning" | "implementing" | "review-testing";

export interface AgentChatLogUsage {
	inputTokens?: number;
	outputTokens?: number;
	totalTokens?: number;
}

export interface AgentChatLogEntry {
	projectId: string;
	issueKey: string;
	issueId: string;
	issueTitle: string;
	agentRole: AgentChatLogRole;
	skillPath: string;
	prompt: string;
	finalMessage: string;
	stdout: string;
	sessionId?: string;
	usage?: AgentChatLogUsage;
	success: boolean;
	error?: string;
	recordedAt: string;
}

export interface RunLease {
	ownerId: string;
	acquiredAt: string;
	heartbeatAt: string;
	expiresAt: string;
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
	complexityScore?: number;
	reviewMode?: "bot" | "human";
	humanReviewNotifiedAt?: string;
	pullRequestApprovedAt?: string;
	pullRequest?: PullRequestRef;
	bugs: BugRecord[];
	splitTasks?: SplitTaskRef[];
	codexUsage?: CodexUsageRecord[];
	lease?: RunLease;
	startedAt: string;
	updatedAt: string;
	lastError?: string;
}

export interface RunOptions {
	issueArg?: string;
	projectId?: string;
	allProjects?: boolean;
	reviewOnly?: boolean;
	poll?: boolean;
	pollIntervalMs?: number;
	maxPollCycles?: number;
	exitWhenIdle?: boolean;
}
