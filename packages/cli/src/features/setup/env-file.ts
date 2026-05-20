import type { SetupDraft } from "./setup.types";

export function renderEnvFile(
	draft: Pick<SetupDraft, "notifications">,
): string {
	return `${renderEnvEntries(buildEnvUpdates(draft))}\n`;
}

export function mergeEnvFile(
	existingContent: string | undefined,
	updates: Record<string, string | undefined>,
): string {
	const definedUpdates = Object.fromEntries(
		Object.entries(updates).filter(([, value]) => value !== undefined),
	);
	if (!existingContent) {
		return `${renderEnvEntries(definedUpdates)}\n`;
	}

	const lines = existingContent.split(/\r?\n/);
	const seen = new Set<string>();
	const merged = lines.map((line) => {
		const match = /^([A-Za-z_][A-Za-z0-9_]*)=/.exec(line);
		if (!match) {
			return line;
		}
		const key = match[1];
		if (!(key in definedUpdates)) {
			return line;
		}
		seen.add(key);
		return renderEnvEntry(key, definedUpdates[key] ?? "");
	});

	const missingEntries = Object.entries(definedUpdates).filter(
		([key]) => !seen.has(key),
	);
	if (missingEntries.length > 0) {
		if (merged.at(-1)?.trim()) {
			merged.push("");
		}
		for (const [key, value] of missingEntries) {
			merged.push(renderEnvEntry(key, value ?? ""));
		}
	}

	return `${merged.join("\n").replace(/\n+$/g, "")}\n`;
}

export function buildEnvUpdates(
	draft: Pick<SetupDraft, "notifications">,
): Record<string, string | undefined> {
	const updates: Record<string, string | undefined> = {};
	if (draft.notifications.email.resendApiKey) {
		updates.RESEND_API_KEY = draft.notifications.email.resendApiKey;
	}
	if (draft.notifications.email.from) {
		updates.RESEND_FROM = draft.notifications.email.from;
	}
	if (draft.notifications.email.to.length > 0) {
		updates.RESEND_TO = draft.notifications.email.to.join(",");
	}
	return updates;
}

export function buildDatabaseEnvUpdates(
	draft: Pick<SetupDraft, "linearApiKey">,
): Record<string, string | undefined> {
	return {
		LINEAR_API_KEY: draft.linearApiKey || undefined,
	};
}

function renderEnvEntries(entries: Record<string, string | undefined>): string {
	return Object.entries(entries)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => renderEnvEntry(key, value ?? ""))
		.join("\n");
}

function renderEnvEntry(key: string, value: string): string {
	return `${key}=${quoteEnvValue(value)}`;
}

function quoteEnvValue(value: string): string {
	if (/^[A-Za-z0-9_./:@-]*$/.test(value)) {
		return value;
	}
	return JSON.stringify(value);
}
