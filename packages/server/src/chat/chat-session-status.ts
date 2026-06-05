import type { RunState } from "devos/features/types";
import type { ChatSessionWorkflowState } from "./types/chat.types";

export function resolveChatSessionWorkflowState(input: {
	runStage?: RunState["stage"] | null;
	taskStatus?: string | null;
}): ChatSessionWorkflowState | null {
	if (input.runStage) {
		return workflowStateFromStage(input.runStage);
	}
	if (!input.taskStatus) {
		return null;
	}
	return workflowStateFromTaskStatus(input.taskStatus);
}

function workflowStateFromStage(
	stage: RunState["stage"],
): ChatSessionWorkflowState {
	if (stage === "in_progress") return "implement";
	if (stage === "in_review") return "testing";
	if (stage === "backlog") return "brainstorm";
	return stage;
}

function workflowStateFromTaskStatus(
	status: string,
): ChatSessionWorkflowState | null {
	const normalized = status.toLowerCase();
	if (normalized === "backlog" || normalized === "brainstorming") {
		return "brainstorm";
	}
	if (
		normalized === "plan" ||
		normalized === "planning" ||
		normalized === "todo"
	) {
		return "plan";
	}
	if (
		normalized === "in_progress" ||
		normalized === "implementing" ||
		normalized === "running"
	) {
		return "implement";
	}
	if (
		normalized === "in_review" ||
		normalized === "pr_created" ||
		normalized === "reviewing" ||
		normalized === "testing" ||
		normalized === "human_review"
	) {
		return "testing";
	}
	if (normalized === "done") return "done";
	if (normalized === "failed" || normalized === "blocked") return "failed";
	if (normalized === "canceled" || normalized === "cancelled")
		return "canceled";
	return null;
}
