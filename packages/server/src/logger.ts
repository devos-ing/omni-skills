import pc from "picocolors";
import type {
	ServerLogContext,
	ServerLogger,
	ServerLoggerOptions,
} from "./logger.types";

type ServerLogLevel = "info" | "warn" | "error" | "fatal";

const LOG_LEVELS: Record<ServerLogLevel, number> = {
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
};

const SILENT_LEVEL = 100;

export const logger: ServerLogger = createServerLogger();

export function createServerLogger(
	options: ServerLoggerOptions = {},
): ServerLogger {
	const env = options.env ?? { PIV_LOG_LEVEL: process.env.PIV_LOG_LEVEL };
	const stderr = options.stderr ?? process.stderr;
	const now = options.now ?? (() => new Date());
	const color = options.color ?? pc.isColorSupported;
	const threshold = resolveLogThreshold(env.PIV_LOG_LEVEL);
	const baseContext = options.context ?? {};

	const write = (
		level: ServerLogLevel,
		...args: [string] | [ServerLogContext, string]
	) => {
		if (LOG_LEVELS[level] < threshold) return;
		const { context, message } = resolveLogArgs(args);
		const mergedContext = { ...baseContext, ...context };
		const { err, fields } = splitErrorField(mergedContext);
		const suffix = formatContext(fields);
		const line = [
			now().toISOString(),
			formatLevel(level, color),
			message,
			suffix,
		]
			.filter(Boolean)
			.join(" ");
		stderr.write(`${line}\n`);
		if (err !== undefined) {
			stderr.write(`${formatError(err)}\n`);
		}
	};

	return {
		info: (...args) => write("info", ...args),
		warn: (...args) => write("warn", ...args),
		error: (...args) => write("error", ...args),
		fatal: (...args) => write("fatal", ...args),
	};
}

export function setupServerProcessErrorHandlers(): void {
	process.on("unhandledRejection", (reason) => {
		logger.error(
			{ err: normalizeError(reason) },
			"Unhandled promise rejection",
		);
	});

	process.on("uncaughtException", (error) => {
		logger.fatal({ err: normalizeError(error) }, "Uncaught exception");
		process.exit(1);
	});
}

export function normalizeError(input: unknown): Record<string, unknown> {
	if (input instanceof Error) {
		const normalized: Record<string, unknown> = {
			name: input.name,
			message: input.message,
			stack: input.stack,
		};
		const databaseError = normalizeServerDatabaseInitializationFields(input);
		if (databaseError) {
			normalized.databasePath = databaseError.databasePath;
			normalized.phase = databaseError.phase;
		}
		if (input.cause) {
			normalized.cause = normalizeError(input.cause);
		}
		return normalized;
	}
	return { message: String(input) };
}

function normalizeServerDatabaseInitializationFields(
	error: Error,
): { databasePath: string; phase: string } | undefined {
	const maybeDatabaseError = error as Error & {
		databasePath?: unknown;
		phase?: unknown;
	};
	if (
		typeof maybeDatabaseError.databasePath === "string" &&
		typeof maybeDatabaseError.phase === "string"
	) {
		return {
			databasePath: maybeDatabaseError.databasePath,
			phase: maybeDatabaseError.phase,
		};
	}
	return undefined;
}

function resolveLogThreshold(value: string | undefined): number {
	if (value === "silent") return SILENT_LEVEL;
	if (value && value in LOG_LEVELS) return LOG_LEVELS[value as ServerLogLevel];
	return LOG_LEVELS.info;
}

function resolveLogArgs(args: [string] | [ServerLogContext, string]): {
	context: ServerLogContext;
	message: string;
} {
	if (typeof args[0] === "string") {
		return { context: {}, message: args[0] };
	}
	const [context, message] = args;
	return { context, message: message ?? "" };
}

function formatLevel(level: ServerLogLevel, color: boolean): string {
	const label = level.toUpperCase().padEnd(5);
	if (!color) return label;
	if (level === "warn") return pc.yellow(label);
	if (level === "error") return pc.red(label);
	if (level === "fatal") return pc.bgRed(pc.white(label));
	return pc.cyan(label);
}

function splitErrorField(context: ServerLogContext): {
	err: unknown;
	fields: ServerLogContext;
} {
	const { err, ...fields } = context as Record<string, unknown>;
	return { err, fields };
}

function formatContext(context: ServerLogContext): string {
	return Object.entries(context)
		.filter(([, value]) => value !== undefined)
		.map(([key, value]) => `${key}=${formatValue(value)}`)
		.join(" ");
}

function formatValue(value: unknown): string {
	if (typeof value === "string") {
		return /^[A-Za-z0-9._:/@-]+$/.test(value) ? value : JSON.stringify(value);
	}
	if (
		value === null ||
		typeof value === "number" ||
		typeof value === "boolean"
	) {
		return String(value);
	}
	if (
		typeof value === "bigint" ||
		typeof value === "function" ||
		typeof value === "symbol"
	) {
		return String(value);
	}
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
}

function formatError(error: unknown): string {
	if (error instanceof Error) {
		return indentBlock(error.stack ?? error.message);
	}
	if (isLogContext(error)) {
		const { stack, cause, ...details } = error as Record<string, unknown>;
		const detailLine = formatContext(details);
		const lines = [detailLine ? `error ${detailLine}` : "error"];
		if (typeof stack === "string") lines.push(stack);
		if (cause !== undefined) lines.push(`cause:\n${formatError(cause)}`);
		return indentBlock(lines.join("\n"));
	}
	return indentBlock(`error ${formatValue(error)}`);
}

function indentBlock(value: string): string {
	return value
		.split("\n")
		.map((line) => `  ${line}`)
		.join("\n");
}

function isLogContext(value: unknown): value is ServerLogContext {
	return typeof value === "object" && value !== null;
}
