import { logger } from "../../../utils/logger";
import { runAgentWithChatLog } from "../agents/agent-chat-log";
import { handleBrainstormStage } from "../brainstorm/brainstorm";
import { handleImplementingStage } from "../implementation/implement-stage";
import { safeNotifyTaskOutcome as safeNotifyTaskOutcomeWithDeps } from "../integration-wrappers";
import { buildIssueJobLogFields } from "../mission/issue-job-log-fields";
import { handlePlanningStage } from "../planning/plan";
import { handleReviewTestingStage } from "../review/review-orchestrator";
import { saveRunState, transitionStage } from "../state";
import type { BrainstormTaskClient } from "../types/brainstorm.types";
import type {
	BuiltInWorkflowPhaseHandlers,
	BuiltInWorkflowPhaseRunInput,
} from "../types/workflow-metadata.types";
import type { WorkflowRuntime } from "../types/workflow.types";
import { appendCodexUsage } from "../usage/usage-state";

export class BuiltInWorkflowPhaseRunner {
	private readonly handlers: BuiltInWorkflowPhaseHandlers;

	constructor(
		private readonly runtime: WorkflowRuntime,
		handlers: Partial<BuiltInWorkflowPhaseHandlers> = {},
	) {
		this.handlers = {
			...this.createDefaultHandlers(),
			...handlers,
		};
	}

	async run(input: BuiltInWorkflowPhaseRunInput): Promise<void> {
		await this.handlers[input.phaseId](input);
	}

	private createDefaultHandlers(): BuiltInWorkflowPhaseHandlers {
		return {
			brainstorm: (input) =>
				handleBrainstormStage(
					input.config,
					input.agent,
					input.taskClient as unknown as BrainstormTaskClient,
					input.state,
					{
						runAgentWithChatLog,
						appendCodexUsage,
						saveRunState,
						transitionStage,
						loggerInfo: logger.info.bind(logger),
						buildIssueJobLogFields: (runState, stage, stageOptions) => ({
							...buildIssueJobLogFields(runState, stage, stageOptions),
						}),
					},
				),
			plan: (input) => this.handlePlan(input),
			implement: (input) =>
				handleImplementingStage(
					input.config,
					input.agent,
					input.taskClient,
					input.state,
					this.runtime,
				),
			testing: (input) =>
				handleReviewTestingStage(
					input.config,
					input.agent,
					input.notifications,
					input.taskClient,
					input.state,
					this.runtime,
				),
		};
	}

	private async handlePlan(input: BuiltInWorkflowPhaseRunInput): Promise<void> {
		await handlePlanningStage(
			input.config,
			input.agent,
			input.notifications,
			input.taskClient,
			input.state,
			{
				runAgentWithChatLog,
				appendCodexUsage,
				saveRunState,
				transitionStage,
				safeNotifyTaskOutcome: (notifyConfig, runState, outcome, error) =>
					safeNotifyTaskOutcomeWithDeps(
						notifyConfig,
						runState,
						outcome,
						error,
						{ sendTaskOutcomeEmail: this.runtime.sendTaskOutcomeEmail },
					),
				loggerInfo: logger.info.bind(logger),
				buildIssueJobLogFields: (runState, stage, stageOptions) => ({
					...buildIssueJobLogFields(runState, stage, stageOptions),
				}),
			},
		);
	}
}
