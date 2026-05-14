export type ValidationResult<T> =
	| { status: "ok"; value: T }
	| { status: "error"; error: string };
