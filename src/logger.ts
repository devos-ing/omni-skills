import pino from "pino";

const prettyEnabled =
	process.env.PIV_LOG_PRETTY === "1" ||
	(process.stdout.isTTY && process.env.PIV_LOG_PRETTY !== "0");

const level = process.env.PIV_LOG_LEVEL ?? "info";

export const logger = pino({
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
