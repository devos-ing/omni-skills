import type {
	NotificationEmailPayload,
	NotificationRequest,
	NotificationSendResult,
	NotificationServiceConfig,
	ResendClient,
} from "./notifications.types";

export interface NotificationService {
	send(request: NotificationRequest): Promise<NotificationSendResult>;
}

const STATUS_LABEL_EMOJI: Record<string, string> = {
	done: "✅",
	blocked: "⛔",
	human_review_required: "🙋",
	human_review: "🙋",
};

export function createNotificationService(input: {
	config: NotificationServiceConfig;
	resendClient: ResendClient;
}): NotificationService {
	return {
		send: async (request) => {
			const configError = validateConfig(input.config);
			if (configError) {
				return { status: "config_error", error: configError };
			}

			const payload = buildNotificationPayload(
				input.config.from as string,
				input.config.to,
				request,
			);

			try {
				await input.resendClient.sendEmail(payload);
			} catch (error) {
				const message =
					error instanceof Error ? error.message : "Unknown send failure";
				return { status: "send_error", error: message };
			}

			return { status: "ok" };
		},
	};
}

function appendStatusEmoji(statusLabel: string): string {
	const key = statusLabel.trim().toLowerCase().replaceAll(/\s+/g, "_");
	const emoji = STATUS_LABEL_EMOJI[key];
	return emoji ? `${statusLabel} ${emoji}` : statusLabel;
}

export function createNotificationConfigFromEnv(
	env: Record<string, string | undefined>,
): NotificationServiceConfig {
	return {
		resendApiKey: trimOptional(env.RESEND_API_KEY),
		from: trimOptional(env.RESEND_FROM),
		to: (env.RESEND_TO ?? "")
			.split(",")
			.map((value) => value.trim())
			.filter((value) => value.length > 0),
	};
}

function buildNotificationPayload(
	from: string,
	to: string[],
	request: NotificationRequest,
): NotificationEmailPayload {
	if (request.type === "task_outcome") {
		return buildTaskOutcomeEmailPayload(
			from,
			to,
			request.state,
			request.outcome,
			request.errorMessage,
		);
	}

	return buildHumanReviewRequiredEmailPayload(
		from,
		to,
		request.state,
		request.complexityScore,
		request.reason,
	);
}

function validateConfig(config: NotificationServiceConfig): string | undefined {
	if (!config.resendApiKey) {
		return "RESEND_API_KEY is required";
	}
	if (!config.from) {
		return "RESEND_FROM is required";
	}
	if (config.to.length === 0) {
		return "RESEND_TO must include at least one recipient";
	}
	return undefined;
}

function trimOptional(value: string | undefined): string | undefined {
	const normalized = value?.trim();
	return normalized && normalized.length > 0 ? normalized : undefined;
}

function buildTaskOutcomeEmailPayload(
	from: string,
	to: string[],
	state: NotificationRequest["state"],
	outcome: "done" | "blocked",
	errorMessage?: string,
): NotificationEmailPayload {
	const statusText = outcome === "done" ? "DONE" : "BLOCKED";
	const subject = `[devos.ing][${state.projectName}] ${state.issue.key} ${statusText}`;
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

function buildHumanReviewRequiredEmailPayload(
	from: string,
	to: string[],
	state: NotificationRequest["state"],
	complexityScore: number,
	reason: string,
): NotificationEmailPayload {
	const subject = `[devos.ing][${state.projectName}] ${state.issue.key} HUMAN REVIEW REQUIRED`;
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
