export function normalizeList(values: string[] | undefined): string[] {
	if (!values) {
		return [];
	}
	return values.map((value) => value.trim()).filter(Boolean);
}

export function toTomlStringArray(values: string[]): string {
	return `[${values.map((value) => JSON.stringify(value)).join(", ")}]`;
}
