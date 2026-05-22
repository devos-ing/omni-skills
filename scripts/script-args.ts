export function readOptionValue(
	rawArgs: string[],
	index: number,
	option: string,
): string {
	const value = rawArgs[index + 1];
	if (!value || value.startsWith("--")) {
		throw new Error(`${option} requires a value`);
	}
	return value;
}
