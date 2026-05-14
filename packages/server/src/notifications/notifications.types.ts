import type { RunState } from "adhdai/features/types";

export type NotificationOutcome = "done" | "blocked";

export interface NotificationEmailPayload {
	from: string;
	to: string[];
	subject: string;
	text: string;
}

export interface TaskOutcomeNotificationRequest {
	type: "task_outcome";
	state: RunState;
	outcome: NotificationOutcome;
	errorMessage?: string;
}

export interface HumanReviewNotificationRequest {
	type: "human_review_required";
	state: RunState;
	complexityScore: number;
	reason: string;
}

export type NotificationRequest =
	| TaskOutcomeNotificationRequest
	| HumanReviewNotificationRequest;

export interface NotificationServiceConfig {
	resendApiKey?: string;
	from?: string;
	to: string[];
}

export interface ResendClient {
	sendEmail(payload: NotificationEmailPayload): Promise<void>;
}

export type NotificationSendResult =
	| { status: "ok" }
	| { status: "config_error"; error: string }
	| { status: "send_error"; error: string };
