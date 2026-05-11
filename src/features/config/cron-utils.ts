export function parseOptionalPositiveIntStrict(
	input: unknown,
	field: string,
	allowZero = false,
): number | undefined {
	if (input === undefined) {
		return undefined;
	}
	if (typeof input !== "number" || !Number.isInteger(input)) {
		throw new Error(`${field} must be an integer`);
	}
	if (allowZero) {
		if (input < 0) {
			throw new Error(`${field} must be zero or a positive integer`);
		}
		return input;
	}
	if (input <= 0) {
		throw new Error(`${field} must be a positive integer`);
	}
	return input;
}

export function normalizeCronRunBoolean(
	value: unknown,
	errorMessage: string,
): boolean | undefined {
	if (value === undefined) {
		return undefined;
	}
	if (value === true || value === false) {
		return value;
	}
	throw new Error(errorMessage);
}
