import type { WorkflowStage } from "../core/types";

const WORKFLOW_STAGE_EMOJI: Record<WorkflowStage, string> = {
	received: "📥",
	planning: "🧭",
	implementing: "🛠️",
	pr_created: "🔀",
	reviewing: "👀",
	testing: "🧪",
	human_review: "🙋",
	blocked: "⛔",
	done: "✅",
	failed: "❌",
};

const STATUS_LABEL_EMOJI: Record<string, string> = {
	done: "✅",
	blocked: "⛔",
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
