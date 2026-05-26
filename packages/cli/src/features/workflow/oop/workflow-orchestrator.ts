import type { LoadedConfig } from "../../config";
import type { ResolvedProjectConfig, RunOptions } from "../../types";
import type {
	PollingSettings,
	WorkflowLinearClient,
} from "../types/workflow.types";
import type { WorkflowRuntime } from "../workflow-runtime";

export interface ProjectWorkflowContext<
	TProject extends ResolvedProjectConfig,
> {
	config: TProject;
	linear: WorkflowLinearClient;
}

export interface WorkflowOrchestratorDeps<
	TProject extends ResolvedProjectConfig,
> {
	resolvePolling(config: LoadedConfig, options: RunOptions): PollingSettings;
	pickProjects(
		config: LoadedConfig,
		options: RunOptions,
		polling: PollingSettings,
	): TProject[];
	usesAllProjectScope(options: RunOptions, polling: PollingSettings): boolean;
	routeProjectContextsForTargetIssue(
		contexts: Array<ProjectWorkflowContext<TProject>>,
		issueArg: string,
	): Promise<Array<ProjectWorkflowContext<TProject>>>;
	handleNoProjectSelection(
		polling: PollingSettings,
		options: RunOptions,
		runtime: WorkflowRuntime,
	): Promise<void>;
	runProjectCycle(input: {
		project: TProject;
		linear: WorkflowLinearClient;
		cycle: number;
		polling: PollingSettings;
	}): Promise<number>;
	handleProjectCycleError(input: {
		error: unknown;
		project: TProject;
		cycle: number;
		polling: PollingSettings;
	}): Promise<void>;
	shouldStopPolling(input: {
		polling: PollingSettings;
		options: RunOptions;
		cycle: number;
		totalIssues: number;
		cycleHadError: boolean;
	}): boolean;
	handlePollingStopped(input: {
		contexts: Array<ProjectWorkflowContext<TProject>>;
		polling: PollingSettings;
		cycle: number;
		totalIssues: number;
		cycleHadError: boolean;
	}): Promise<void>;
	sleepForWorkflow(runtime: WorkflowRuntime, ms: number): Promise<void>;
}

export class WorkflowOrchestrator<TProject extends ResolvedProjectConfig> {
	constructor(
		private readonly config: LoadedConfig,
		private readonly options: RunOptions,
		private readonly runtime: WorkflowRuntime,
		private readonly deps: WorkflowOrchestratorDeps<TProject>,
	) {}

	async run(): Promise<void> {
		const polling = this.deps.resolvePolling(this.config, this.options);
		const projects = this.deps.pickProjects(this.config, this.options, polling);
		if (projects.length === 0) {
			await this.deps.handleNoProjectSelection(
				polling,
				this.options,
				this.runtime,
			);
			return;
		}
		let contexts = projects.map((project) => ({
			config: project,
			linear: this.runtime.createLinearClient(project),
		}));
		if (this.shouldRouteTargetIssue(contexts.length, polling)) {
			contexts = await this.deps.routeProjectContextsForTargetIssue(
				contexts,
				this.options.issueArg ?? "",
			);
			if (contexts.length === 0) return;
		}
		await this.runCycles(contexts, polling);
	}

	private shouldRouteTargetIssue(
		contextCount: number,
		polling: PollingSettings,
	): boolean {
		return Boolean(
			this.options.issueArg &&
				!this.options.projectId &&
				this.deps.usesAllProjectScope(this.options, polling) &&
				contextCount > 1,
		);
	}

	private async runCycles(
		contexts: Array<ProjectWorkflowContext<TProject>>,
		polling: PollingSettings,
	): Promise<void> {
		let cycle = 0;
		while (true) {
			cycle += 1;
			const cycleResult = await this.runCycle(contexts, polling, cycle);
			if (
				this.deps.shouldStopPolling({
					polling,
					options: this.options,
					cycle,
					...cycleResult,
				})
			) {
				await this.deps.handlePollingStopped({
					contexts,
					polling,
					cycle,
					...cycleResult,
				});
				return;
			}
			await this.deps.sleepForWorkflow(this.runtime, polling.intervalMs);
		}
	}

	private async runCycle(
		contexts: Array<ProjectWorkflowContext<TProject>>,
		polling: PollingSettings,
		cycle: number,
	): Promise<{ totalIssues: number; cycleHadError: boolean }> {
		let totalIssues = 0;
		let cycleHadError = false;
		for (const context of contexts) {
			try {
				totalIssues += await this.deps.runProjectCycle({
					project: context.config,
					linear: context.linear,
					cycle,
					polling,
				});
			} catch (error) {
				if (!polling.enabled || this.options.issueArg) throw error;
				cycleHadError = true;
				await this.deps.handleProjectCycleError({
					error,
					project: context.config,
					cycle,
					polling,
				});
			}
		}
		return { totalIssues, cycleHadError };
	}
}
