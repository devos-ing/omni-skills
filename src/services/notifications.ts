import type { ResolvedNotificationEmailConfig, RunState } from "../core/types";
import { appendStatusEmoji } from "../utils/status";

const RESEND_API_URL = "https://api.resend.com/emails";

export type NotificationOutcome = "done" | "blocked";

interface NotificationEmailPayload {
	from: string;
	to: string[];
	subject: string;
	text: string;
}

export async function sendTaskOutcomeEmail(
	config: ResolvedNotificationEmailConfig,
	state: RunState,
	outcome: NotificationOutcome,
	errorMessage?: string,
): Promise<void> {
	if (!config.enabled) {
		return;
	}
	if (!config.resendApiKey || !config.from || config.to.length === 0) {
		throw new Error(
			"Email notifications are enabled but required settings are missing",
		);
	}

	const payload = buildTaskOutcomeEmailPayload(
		config.from,
		config.to,
		state,
		outcome,
		errorMessage,
	);
	await sendResendEmail(config.resendApiKey, payload);
}

export async function sendHumanReviewRequiredEmail(
	config: ResolvedNotificationEmailConfig,
	state: RunState,
	input: { complexityScore: number; reason: string },
): Promise<void> {
	if (!config.enabled) {
		return;
	}
	if (!config.resendApiKey || !config.from || config.to.length === 0) {
		throw new Error(
			"Email notifications are enabled but required settings are missing",
		);
	}

	const payload = buildHumanReviewRequiredEmailPayload(
		config.from,
		config.to,
		state,
		input.complexityScore,
		input.reason,
	);
	await sendResendEmail(config.resendApiKey, payload);
}

export function buildTaskOutcomeEmailPayload(
	from: string,
	to: string[],
	state: RunState,
	outcome: NotificationOutcome,
	errorMessage?: string,
): NotificationEmailPayload {
	const statusText = outcome === "done" ? "DONE" : "BLOCKED";
	const subject = `[ADHD.ai][${state.projectName}] ${state.issue.key} ${statusText}`;
	const lines = [
		`Project: ${state.projectName} (${state.projectId})`,
		`Issue: ${state.issue.key} - ${state.issue.title}`,
		`URL: ${state.issue.url}`,
		`Status: ${appendStatusEmoji(statusText)}`,
		`Updated: ${state.updatedAt}`,
	];

	if (state.pullRequest?.url) {
		lines.push(`PR: ${state.pullRequest.url}`);
	}

	if (outcome === "done") {
		lines.push(
			`Summary: ${state.testingSummary ?? state.reviewSummary ?? "Completed"}`,
		);
	} else {
		lines.push(
			`Error: ${errorMessage ?? state.lastError ?? "Workflow blocked"}`,
		);
	}

	return {
		from,
		to,
		subject,
		text: lines.join("\n"),
	};
}

export function buildHumanReviewRequiredEmailPayload(
	from: string,
	to: string[],
	state: RunState,
	complexityScore: number,
	reason: string,
): NotificationEmailPayload {
	const subject = `[ADHD.ai][${state.projectName}] ${state.issue.key} HUMAN REVIEW REQUIRED`;
	const lines = [
		`Project: ${state.projectName} (${state.projectId})`,
		`Issue: ${state.issue.key} - ${state.issue.title}`,
		`URL: ${state.issue.url}`,
		`Status: ${appendStatusEmoji("HUMAN REVIEW REQUIRED")}`,
		`Complexity Score: ${complexityScore}/10`,
		`Reason: ${reason}`,
		`Updated: ${state.updatedAt}`,
	];

	if (state.pullRequest?.url) {
		lines.push(`PR: ${state.pullRequest.url}`);
	}

	return {
		from,
		to,
		subject,
		text: lines.join("\n"),
	};
}

async function sendResendEmail(
	resendApiKey: string,
	payload: NotificationEmailPayload,
): Promise<void> {
	const response = await fetch(RESEND_API_URL, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${resendApiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		const body = (await response.text()).trim();
		const detail = body ? ` ${body}` : "";
		throw new Error(
			`Resend send failed with status ${response.status}.${detail}`.trim(),
		);
	}
}
