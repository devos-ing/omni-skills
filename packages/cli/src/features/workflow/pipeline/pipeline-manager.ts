import type { ResolvedProjectConfig, RunState } from "../../types";
import type {
	PipelineBeforePhaseResult,
	PipelineRunResult,
	WorkflowMetadata,
	WorkflowPhaseDefinition,
} from "../types/workflow-metadata.types";
import {
	findWorkflowPhaseByStage,
	unsupportedWorkflowStageError,
} from "../utils/workflow-phase";
import type { PhaseRunner } from "./phase-runner";

export interface PipelineManagerDeps {
	phaseRunner: PhaseRunner;
}

export class PipelineManager {
	constructor(
		private readonly metadata: WorkflowMetadata,
		private readonly deps: PipelineManagerDeps,
	) {}

	async run(input: {
		config: ResolvedProjectConfig;
		state: RunState;
		shouldContinue(state: RunState): boolean;
		beforePhase?(
			phase: WorkflowPhaseDefinition,
		): Promise<PipelineBeforePhaseResult>;
		afterPhase?(phase: WorkflowPhaseDefinition): Promise<void>;
	}): Promise<PipelineRunResult> {
		const phaseResults: PipelineRunResult["phaseResults"] = [];
		while (input.shouldContinue(input.state)) {
			const phase = findWorkflowPhaseByStage(this.metadata, input.state.stage);
			if (!phase) {
				throw unsupportedWorkflowStageError(input.state.stage);
			}
			const beforePhase = await input.beforePhase?.(phase);
			if (beforePhase === "skip") {
				phaseResults.push({ status: "skipped", phase });
				if (input.state.stage === phase.stage) {
					return { ok: true, phaseResults };
				}
				continue;
			}
			const result = await this.deps.phaseRunner.run({
				config: input.config,
				state: input.state,
				phase,
				metadata: this.metadata,
			});
			phaseResults.push(result);
			if (result.status === "rejected") {
				return { ok: false, phaseResults };
			}
			await input.afterPhase?.(phase);
		}
		return { ok: true, phaseResults };
	}
}
