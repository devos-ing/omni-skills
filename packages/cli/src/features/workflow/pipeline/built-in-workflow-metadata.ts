import type { ResolvedProjectConfig } from "../../types";
import type {
	WorkflowAgentAssignment,
	WorkflowMetadata,
} from "../types/workflow-metadata.types";

export function createBuiltInWorkflowMetadata(
	config: ResolvedProjectConfig,
): WorkflowMetadata {
	return {
		id: "devos.builtin.plan-implement-testing",
		title: "Plan, implement, testing",
		description: "Built-in workflow pipeline after task intake clarification.",
		phases: [
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
