export function parseJsonRecord(text: string): Record<string, unknown> | null {
	try {
		const parsed = JSON.parse(text) as unknown;
		return isRecord(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

export function readStructuredToolName(
	record: Record<string, unknown>,
): string | null {
	const type = readString(record, "type")?.toLowerCase() ?? "";
	const item = readRecord(record, "item");
	const itemType = item ? (readString(item, "type")?.toLowerCase() ?? "") : "";
	if (
		!type.includes("tool") &&
		!type.includes("mcp") &&
		!itemType.includes("tool")
	) {
		return null;
	}
	return (
		readString(record, "recipient_name") ??
		readString(record, "tool_name") ??
		readString(record, "toolName") ??
		readString(record, "name") ??
		(item ? readString(item, "recipient_name") : null) ??
		(item ? readString(item, "tool_name") : null) ??
		(item ? readString(item, "name") : null)
	);
}

export function readAllStrings(value: unknown): string[] {
	if (typeof value === "string") return [value];
	if (Array.isArray(value))
		return value.flatMap((item) => readAllStrings(item));
	if (!isRecord(value)) return [];
	return Object.values(value).flatMap((item) => readAllStrings(item));
}

function readRecord(
	record: Record<string, unknown>,
	key: string,
): Record<string, unknown> | null {
	const value = record[key];
	return isRecord(value) ? value : null;
}

function readString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	const value = record[key];
	return typeof value === "string" && value.trim() ? value : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
