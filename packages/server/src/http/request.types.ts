export type JsonParseResult<T> =
	| { status: "ok"; value: T }
	| { status: "error"; error: string };

export type MethodCheckResult =
	| { status: "ok" }
	| { status: "error"; response: Response };
