import type {
	DeepPartial,
	NotificationConfig,
	ResolvedNotificationConfig,
} from "../../core/types";
import { normalizeOptionalValue } from "./env-normalizers";

export function resolveNotifications(
	base: ResolvedNotificationConfig,
	override: DeepPartial<NotificationConfig> | undefined,
): ResolvedNotificationConfig {
	const email = override?.email;
	const resendApiKey =
		typeof email?.resendApiKey === "string"
			? normalizeOptionalValue(email.resendApiKey)
			: base.email.resendApiKey;
	const from =
		typeof email?.from === "string"
			? normalizeOptionalValue(email.from)
			: base.email.from;
	const to = normalizeRecipientsOverride(email?.to) ?? base.email.to;
	const enabled = resolveNotificationEnabled(email?.enabled, resendApiKey);
	return { email: { enabled, resendApiKey, from, to } };
}

function resolveNotificationEnabled(
	input: unknown,
	resendApiKey: string | undefined,
): boolean {
	if (input === undefined) {
		return Boolean(resendApiKey);
	}
	if (input === true) {
		return true;
	}
	if (input === false) {
		return false;
	}
	throw new Error("notifications.email.enabled must be a boolean");
}

function normalizeRecipientsOverride(input: unknown): string[] | undefined {
	if (input === undefined) {
		return undefined;
	}
	if (!Array.isArray(input)) {
		throw new Error("notifications.email.to must be an array of email strings");
	}
	const recipients = input.map((value, index) => {
		if (typeof value !== "string") {
			throw new Error(
				`notifications.email.to[${index}] must be an email string`,
			);
		}
		return value.trim();
	});
	return recipients.filter((recipient) => recipient.length > 0);
}
