export function replaceAt(
	values: string[],
	index: number,
	value: string,
): string[] {
	const next = [...values];
	next[index] = value;
	return next;
}
