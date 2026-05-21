import pc from "picocolors";
import type {
	CliLogContext,
	CliLogger,
	CliLoggerOptions,
} from "./logger.types";

type CliLogLevel = "info" | "warn" | "error" | "fatal";

const LOG_LEVELS: Record<CliLogLevel, number> = {
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
};

const SILENT_LEVEL = 100;

export const logger = createLogger();

export function createLogger(options: CliLoggerOptions = {}): CliLogger {
	const env = options.env ?? { PIV_LOG_LEVEL: process.env.PIV_LOG_LEVEL };
	const stderr = options.stderr ?? process.stderr;
	const now = options.now ?? (() => new Date());
	const color = options.color ?? pc.isColorSupported;
	const threshold = resolveLogThreshold(env.PIV_LOG_LEVEL);
	const baseContext = options.context ?? {};

	const write = (
		level: CliLogLevel,
		...args: [string] | [CliLogContext, string]
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
		child: (context) =>
			createLogger({
				context: { ...baseContext, ...context },
				env,
				stderr,
				now,
				color,
			}),
	};
}

export function setupProcessErrorHandlers(): void {
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
		return {
			name: input.name,
			message: input.message,
			stack: input.stack,
		};
	}
	return { message: String(input) };
}

export type { CliLogContext, CliLogger } from "./logger.types";

function resolveLogThreshold(value: string | undefined): number {
	if (value === "silent") return SILENT_LEVEL;
	if (value && value in LOG_LEVELS) return LOG_LEVELS[value as CliLogLevel];
	return LOG_LEVELS.info;
}

function resolveLogArgs(args: [string] | [CliLogContext, string]): {
	context: CliLogContext;
	message: string;
} {
	if (typeof args[0] === "string") {
		return { context: {}, message: args[0] };
	}
	const [context, message] = args;
	return { context, message: message ?? "" };
}

function formatLevel(level: CliLogLevel, color: boolean): string {
	const label = level.toUpperCase().padEnd(5);
	if (!color) return label;
	if (level === "warn") return pc.yellow(label);
	if (level === "error") return pc.red(label);
	if (level === "fatal") return pc.bgRed(pc.white(label));
	return pc.cyan(label);
}

function splitErrorField(context: CliLogContext): {
	err: unknown;
	fields: CliLogContext;
} {
	const { err, ...fields } = context as Record<string, unknown>;
	return { err, fields };
}

function formatContext(context: CliLogContext): string {
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

function isLogContext(value: unknown): value is CliLogContext {
	return typeof value === "object" && value !== null;
}
