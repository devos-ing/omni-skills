import type { WorkflowStage } from "../features/types";

const WORKFLOW_STAGE_EMOJI: Record<WorkflowStage, string> = {
	backlog: "📥",
	brainstorm: "💭",
	plan: "🧭",
	in_progress: "🛠️",
	in_review: "👀",
	canceled: "⛔",
	done: "✅",
	failed: "❌",
};

const STATUS_LABEL_EMOJI: Record<string, string> = {
	done: "✅",
	canceled: "⛔",
	failed: "❌",
	human_review_required: "🙋",
	human_review: "🙋",
};

export function formatWorkflowStageDisplay(stage: WorkflowStage): string {
	return `${stage} ${WORKFLOW_STAGE_EMOJI[stage]}`;
}

export function appendStatusEmoji(statusLabel: string): string {
	const key = statusLabel.trim().toLowerCase().replaceAll(/\s+/g, "_");
	const emoji = STATUS_LABEL_EMOJI[key];
	if (!emoji) {
		return statusLabel;
	}
	return `${statusLabel} ${emoji}`;
}
