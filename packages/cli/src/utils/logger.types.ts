export type CliLogContext = object;

export type CliLogMethod = (
	...args: [message: string] | [context: CliLogContext, message: string]
) => void;

export interface CliLogger {
	info: CliLogMethod;
	warn: CliLogMethod;
	error: CliLogMethod;
	fatal: CliLogMethod;
	child(context: CliLogContext): CliLogger;
}

export interface CliLoggerOptions {
	context?: CliLogContext;
	env?: { PIV_LOG_LEVEL?: string };
	stderr?: { write(chunk: string): unknown };
	now?: () => Date;
	color?: boolean;
}
