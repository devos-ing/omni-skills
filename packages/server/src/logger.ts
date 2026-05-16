import pino from "pino";
import type { ServerLogger } from "./logger.types";

const prettyEnabled =
	process.env.PIV_LOG_PRETTY === "1" ||
	(process.stdout.isTTY && process.env.PIV_LOG_PRETTY !== "0");

const level = process.env.PIV_LOG_LEVEL ?? "info";

export const logger: ServerLogger = pino({
	level,
	base: undefined,
	timestamp: pino.stdTimeFunctions.isoTime,
	transport: prettyEnabled
		? {
				target: "pino-pretty",
				options: {
					colorize: true,
					translateTime: "SYS:standard",
					ignore: "pid,hostname",
				},
			}
		: undefined,
});

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
