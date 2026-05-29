import type {
	ResolvedNotificationConfig,
	ResolvedProjectConfig,
	RunOptions,
	RunState,
} from "../../types";
import { ReviewMergeDecisionManager } from "../review/review-orchestrator";
import { saveRunState, transitionStage } from "../state";
import type {
	WorkflowRuntime,
	WorkflowTaskClient,
} from "../types/workflow.types";
import { heartbeatRunLease } from "../workflow-lease";
import { isReviewOnlyExecutableStage } from "../workflow-queue";
import { createBuiltInWorkflowMetadata } from "./built-in-workflow-metadata";
import { BuiltInWorkflowPhaseRunner } from "./built-in-workflow-phase-runner";
import { PhaseRunner } from "./phase-runner";
import { PipelineManager } from "./pipeline-manager";

export class IssuePipelineExecutor {
	constructor(
		private readonly config: ResolvedProjectConfig,
		private readonly notifications: ResolvedNotificationConfig,
		private readonly taskClient: WorkflowTaskClient,
		private readonly options: RunOptions,
		private readonly leaseOwnerId: string,
		private readonly leaseTimeoutMs: number,
		private readonly runtime: WorkflowRuntime,
	) {}

	async execute(state: RunState): Promise<void> {
		if (this.options.reviewOnly && state.stage === "done") {
			await this.createReviewMergeManager().handleDoneReviewMergeStage(state);
			return;
		}

		await this.runtime.ensureBaseBranchFresh(this.config);
		const agent = this.runtime.createAgentAdapter(this.config);
		if (state.stage === "backlog") {
			await this.handleReceivedStage(state);
		}
		const phaseRunner = new BuiltInWorkflowPhaseRunner(this.runtime);
		const pipeline = new PipelineManager(
			createBuiltInWorkflowMetadata(this.config),
			{
				phaseRunner: new PhaseRunner({
					runAgent: async ({ phase, assignment }) => {
						await phaseRunner.run({
							phaseId: phase.id,
							config: this.config,
							agent,
							notifications: this.notifications,
							taskClient: this.taskClient,
							state,
						});
						return {
							assignment,
							result: { stdout: "", finalMessage: phase.title },
						};
					},
				}),
			},
		);
		const pipelineResult = await pipeline.run({
			config: this.config,
			state,
			shouldContinue: (runState) => this.shouldContinue(runState),
			beforePhase: async (phase) => {
				await heartbeatRunLease(
					this.config.workspacePath,
					state,
					this.leaseOwnerId,
					this.leaseTimeoutMs,
				);
				if (phase.id !== "testing" || !this.options.reviewOnly) {
					return "continue";
				}
				const parked =
					await this.createReviewMergeManager().maybeParkReviewOnlyConflict(
						state,
					);
				return parked ? "skip" : "continue";
			},
		});
		if (!pipelineResult.ok) {
			const failed = pipelineResult.phaseResults.find(
				(result) => result.status === "rejected",
			);
			throw new Error(
				failed?.status === "rejected"
					? failed.error
					: "Workflow pipeline failed",
			);
		}
	}

	private shouldContinue(state: RunState): boolean {
		return (
			state.stage !== "done" &&
			state.stage !== "canceled" &&
			state.stage !== "failed" &&
			!(
				state.stage === "brainstorm" &&
				Boolean(state.brainstormNeedsInfoQuestions?.length)
			) &&
			(!this.options.reviewOnly || isReviewOnlyExecutableStage(state.stage)) &&
			!(state.stage === "in_review" && state.humanReviewNotifiedAt)
		);
	}

	private createReviewMergeManager(): ReviewMergeDecisionManager {
		return new ReviewMergeDecisionManager(
			this.config,
			this.notifications,
			this.taskClient,
			this.runtime,
		);
	}

	private async handleReceivedStage(state: RunState): Promise<void> {
		await this.taskClient.markStage(state.issue.id, "plan");
		await this.taskClient.comment(
			state.issue.id,
			"devos.ing started planning.",
		);
		Object.assign(state, transitionStage(state, "plan"));
		await saveRunState(this.config.workspacePath, state);
	}
}
