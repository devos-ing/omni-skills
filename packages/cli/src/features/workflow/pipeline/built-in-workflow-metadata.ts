import type { ResolvedProjectConfig } from "../../types";
import type {
	WorkflowAgentAssignment,
	WorkflowMetadata,
} from "../types/workflow-metadata.types";

export function createBuiltInWorkflowMetadata(
	config: ResolvedProjectConfig,
): WorkflowMetadata {
	return {
		id: "devos.builtin.brainstorm-plan-implement-testing",
		title: "Brainstorm, plan, implement, testing",
		description: "Built-in stage-one workflow pipeline.",
		phases: [
			{
				id: "brainstorm",
				title: "Brainstorm",
				stage: "brainstorm",
				agentAssignments: [
					agent(
						"brainstormer",
						"brainstorm",
						"brainstorm",
						config.skills.brainstorm,
					),
				],
			},
			{
				id: "plan",
				title: "Plan",
				stage: "plan",
				agentAssignments: [
					agent("planner", "planning", "planning", config.skills.plan),
				],
			},
			{
				id: "implement",
				title: "Implement",
				stage: "in_progress",
				agentAssignments: [
					agent(
						"implementer",
						"implementing",
						"implementation",
						config.skills.implement,
					),
				],
			},
			{
				id: "testing",
				title: "Testing",
				stage: "in_review",
				agentAssignments: [
					agent(
						"reviewer",
						"review-testing",
						"review-testing",
						config.skills.reviewTest,
					),
				],
			},
		],
	};
}

function agent(
	name: string,
	role: WorkflowAgentAssignment["role"],
	skillName: string,
	path: string,
): WorkflowAgentAssignment {
	return {
		name,
		role,
		required: true,
		skills: [{ name: skillName, path }],
	};
}
