import type { RunState } from "../../types";
import type {
	WorkflowMetadata,
	WorkflowPhaseDefinition,
} from "../types/workflow-metadata.types";

export function findWorkflowPhaseByStage(
	metadata: WorkflowMetadata,
	stage: RunState["stage"],
): WorkflowPhaseDefinition | null {
	return metadata.phases.find((phase) => phase.stage === stage) ?? null;
}

export function unsupportedWorkflowStageError(stage: RunState["stage"]): Error {
	return new Error(`Unsupported workflow stage: ${stage}`);
}
