export type ServerLogContext = object;

export type ServerLogMethod = (
	...args: [message: string] | [context: ServerLogContext, message: string]
) => void;

export interface ServerLogger {
	info: ServerLogMethod;
	warn: ServerLogMethod;
	error: ServerLogMethod;
	fatal: ServerLogMethod;
}

export interface ServerLoggerOptions {
	context?: ServerLogContext;
	env?: { PIV_LOG_LEVEL?: string };
	stderr?: { write(chunk: string): unknown };
	now?: () => Date;
	color?: boolean;
}
