export type NotificationOutcome = "done" | "blocked";

export interface NotificationEmailPayload {
	from: string;
	to: string[];
	subject: string;
	text: string;
}
