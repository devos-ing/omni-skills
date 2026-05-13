import { mkdtemp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { LoadedConfig } from "../src/features/config";
import type {
	LinearIssue,
	ResolvedProjectConfig,
	RunOptions,
	RunState,
} from "../src/features/types";
import { loadRunState, saveRunState } from "../src/features/workflow/state";
import {
	type WorkflowLinearClient,
	type WorkflowRuntime,
	createWorkflowRuntime,
} from "../src/features/workflow/workflow-runtime";
import type {
	AgentAdapter,
	AgentResult,
} from "../src/integrations/agent-adapters";
import { pr, project } from "./smoke-fixtures";

export interface SmokeHarness {
	config: LoadedConfig;
	runtime: WorkflowRuntime;
	agents: Map<string, FakeAgent>;
	linears: Map<string, FakeLinear>;
	notifications: Array<{ type: string; issueKey: string }>;
	agent(projectId: string): FakeAgent;
	linear(projectId: string): FakeLinear;
	project(projectId: string): ResolvedProjectConfig;
	run(options: RunOptions): Promise<void>;
	state(projectId: string, issueKey: string): Promise<RunState | null>;
	addIssue(projectId: string, issue: LinearIssue): void;
	presetState(projectId: string, state: RunState): Promise<void>;
}

export async function createSmokeHarness(): Promise<SmokeHarness> {
	const workspacePath = await mkdtemp(path.join(os.tmpdir(), "adhd-smoke-"));
	const projects = [project("default"), project("api", "linear-api")].map(
		(config) => ({ ...config, workspacePath, executionPath: workspacePath }),
	);
	const config: LoadedConfig = {
		projects,
		polling: {
			intervalMs: 1,
			exitWhenIdle: true,
			staleRunTimeoutMs: 1000,
		},
		notifications: { email: { enabled: true, to: ["ops@example.invalid"] } },
	};
	const allIssues = new Map<string, LinearIssue>();
	const agents = new Map(projects.map((p) => [p.id, new FakeAgent()]));
	const linears = new Map(
		projects.map((p) => [p.id, new FakeLinear(p, allIssues)]),
	);
	const notifications: SmokeHarness["notifications"] = [];
	const runtime = createWorkflowRuntime({
		createLinearClient: (p) => linears.get(p.id) as WorkflowLinearClient,
		createAgentAdapter: (p) => agents.get(p.id) as FakeAgent,
		ensureBaseBranchFresh: async () => {},
		findOpenPullRequestForIssue: async (_p, key) => pr(key),
		getPullRequestMergeStatus: async () => ({}),
		prepareImplementationBranch: async (_p, key) =>
			`codex/${key.toLowerCase()}`,
		createDraftPrFromWorktree: async (_p, key) => pr(key),
		updateDraftPrFromWorktree: async () => true,
		commentOnPr: async () => {},
		markPrReadyForReview: async () => true,
		squashMergePullRequest: async () => true,
		sendTaskOutcomeEmail: async (_email, state, outcome) => {
			notifications.push({ type: outcome, issueKey: state.issue.key });
		},
		sendHumanReviewRequiredEmail: async (_email, state) => {
			notifications.push({ type: "human", issueKey: state.issue.key });
		},
	});
	return {
		config,
		runtime,
		agents,
		linears,
		notifications,
		agent: (projectId) => required(agents, projectId),
		linear: (projectId) => required(linears, projectId),
		project: (projectId) => {
			const selected = config.projects.find((item) => item.id === projectId);
			if (!selected) {
				throw new Error(`Missing smoke project ${projectId}`);
			}
			return selected;
		},
		run: (options) =>
			import("../src/features/workflow/workflow").then(({ runWorkflow }) =>
				runWorkflow(config, options, runtime),
			),
		state: (projectId, issueKey) =>
			loadRunState(workspacePath, projectId, issueKey),
		addIssue: (projectId, issue) => {
			allIssues.set(issue.identifier, issue);
			linears.get(projectId)?.ownedIssueKeys.add(issue.identifier);
		},
		presetState: (projectId, state) => saveRunState(workspacePath, state),
	};
}

function required<T>(map: Map<string, T>, key: string): T {
	const value = map.get(key);
	if (!value) {
		throw new Error(`Missing smoke fixture ${key}`);
	}
	return value;
}

export class FakeAgent implements AgentAdapter {
	plans: Array<AgentResult | Error> = [];
	taskIntakes: Array<AgentResult | Error> = [];
	resumes: Array<AgentResult | Error> = [];
	reviews: Array<AgentResult | Error> = [];
	githubComments: Array<AgentResult | Error> = [];
	delayMs = 0;

	async runPlan(): Promise<AgentResult> {
		return this.next(this.plans, "plan-1");
	}
	async runTaskIntake(): Promise<AgentResult> {
		return this.next(this.taskIntakes);
	}
	async resume(): Promise<AgentResult> {
		return this.next(this.resumes);
	}
	async runReview(): Promise<AgentResult> {
		return this.next(this.reviews);
	}
	async runGithubComment(): Promise<AgentResult> {
		return this.next(this.githubComments);
	}
	private next(queue: Array<AgentResult | Error>, sessionId?: string) {
		const result = queue.shift() ?? { finalMessage: "", stdout: "", sessionId };
		if (result instanceof Error) {
			throw result;
		}
		if (this.delayMs <= 0) {
			return Promise.resolve(result);
		}
		return new Promise<AgentResult>((resolve) => {
			setTimeout(() => resolve(result), this.delayMs);
		});
	}
}

export class FakeLinear {
	ownedIssueKeys = new Set<string>();
	stageCalls: Array<{ issueId: string; stage: string }> = [];
	comments: string[] = [];
	children: string[] = [];
	canceled: string[] = [];

	constructor(
		private readonly project: ResolvedProjectConfig,
		private readonly issues: Map<string, LinearIssue>,
	) {}

	async fetchWork(issueArg?: string): Promise<LinearIssue[]> {
		const issues = issueArg
			? [this.issues.get(issueArg)].filter(Boolean)
			: [...this.ownedIssueKeys].map((key) => this.issues.get(key));
		return issues.filter((issue): issue is LinearIssue =>
			Boolean(issue && issue.state.id === "assigned" && this.inProject(issue)),
		);
	}
	async fetchIssueByIdentifier(key: string): Promise<LinearIssue | null> {
		return this.issues.get(key) ?? null;
	}
	async fetchReviewOnlyWork(): Promise<LinearIssue[]> {
		const stages = new Set(["pr_created", "reviewing", "testing", "done"]);
		return [...this.ownedIssueKeys]
			.map((key) => this.issues.get(key))
			.filter((issue): issue is LinearIssue =>
				Boolean(issue && stages.has(issue.state.id) && this.inProject(issue)),
			);
	}
	async isAssignedState(stateId: string): Promise<boolean> {
		return stateId === "assigned";
	}
	async markStage(issueId: string, stage: string): Promise<void> {
		this.stageCalls.push({ issueId, stage });
		for (const issue of this.issues.values()) {
			if (issue.id === issueId) issue.state = { id: stage, name: stage };
		}
	}
	async markCanceled(issueId: string): Promise<void> {
		this.canceled.push(issueId);
	}
	async updateIssueDetails(): Promise<void> {}
	async createBacklogTask(task: { title: string }) {
		return {
			id: task.title,
			identifier: task.title,
			title: task.title,
			url: "#",
		};
	}
	async createTodoIssueFromPlan(_parent: unknown, task: { title: string }) {
		this.children.push(task.title);
		return {
			id: task.title,
			identifier: task.title,
			title: task.title,
			url: "#",
		};
	}
	async applyStageLabel(): Promise<void> {}
	async clearWorkflowStageLabels(): Promise<void> {}
	async comment(_issueId: string, body: string): Promise<void> {
		this.comments.push(body);
	}
	private inProject(issue: LinearIssue): boolean {
		return (
			!this.project.linear.projectId ||
			issue.projectId === this.project.linear.projectId
		);
	}
}
