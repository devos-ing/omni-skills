import type { ResolvedProjectConfig, RunState } from "../../types";
import type {
	PhaseAgentRunInput,
	PhaseAgentRunResult,
	PhaseRunResult,
	WorkflowMetadata,
	WorkflowPhaseDefinition,
} from "../types/workflow-metadata.types";
import { formatWorkflowError } from "../utils/error-format";

export interface PhaseRunnerDeps {
	runAgent(input: PhaseAgentRunInput): Promise<PhaseAgentRunResult>;
}

export class PhaseRunner {
	constructor(private readonly deps: PhaseRunnerDeps) {}

	async run(input: {
		config: ResolvedProjectConfig;
		state: RunState;
		phase: WorkflowPhaseDefinition;
		metadata: WorkflowMetadata;
	}): Promise<PhaseRunResult> {
		const { config, state, phase } = input;
		const settled = await Promise.allSettled(
			phase.agentAssignments.map((assignment) =>
				this.deps.runAgent({ config, state, phase, assignment }),
			),
		);
		const agents: PhaseAgentRunResult[] = [];
		for (const [index, result] of settled.entries()) {
			const assignment = phase.agentAssignments[index];
			if (result.status === "fulfilled") {
				agents.push(result.value);
				continue;
			}
			if (assignment?.required !== false) {
				return {
					status: "rejected",
					phase,
					error: formatWorkflowError(result.reason),
				};
			}
		}
		return { status: "fulfilled", phase, agents };
	}
}
