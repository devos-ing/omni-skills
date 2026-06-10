import type { TaskActivityRecord } from "@/lib/api";

import { formatOperatorActivityText } from "./issue-activity-display-utils";

export function createActivityCopyText(activity: TaskActivityRecord): string {
	const lines = [`${activity.actorId} ${activity.title}`];
	if (activity.status?.trim()) {
		lines.push(`Status: ${activity.status}`);
	}
	const body = formatOperatorActivityText(activity.body);
	if (body) {
		lines.push("", body);
	}
	const stepLines = activity.steps?.flatMap((step) => {
		const summary = `${step.stepNumber}. ${step.action} [${step.status}]`;
		const detail = step.detail ? formatOperatorActivityText(step.detail) : "";
		return detail ? [summary, `   ${detail}`] : [summary];
	});
	if (stepLines?.length) {
		lines.push("", "Steps:", ...stepLines);
	}
	return lines.join("\n");
}
