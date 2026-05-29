import type { WorkflowTaskExecutionStreamInput } from "./types/workflow-data.types";

export function streamExecutionMetadata(
	input: WorkflowTaskExecutionStreamInput,
	taskId: string,
) {
	return {
		projectId: input.projectId,
		taskId,
		issueKey: input.issueKey,
		stage: input.stage,
		agentRole: input.agentRole,
		agentBackend: input.agentBackend,
		agentModel: input.agentModel,
		phrase: input.phrase,
	};
}
