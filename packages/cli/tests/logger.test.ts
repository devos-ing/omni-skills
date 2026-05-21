import { describe, expect, it } from "bun:test";
import { createLogger, normalizeError } from "../src/utils/logger";

describe("CLI logger", () => {
	it("writes string-only human log lines to stderr", () => {
		const { logger, output } = createCapturedLogger();

		logger.info("Ready to work");

		expect(output()).toBe("2026-05-21T10:00:00.000Z INFO  Ready to work\n");
	});

	it("formats context fields and child logger context", () => {
		const { logger, output } = createCapturedLogger();

		logger.child({ projectId: "api" }).info(
			{
				issueKey: "ENG-1",
				retry: 2,
				empty: undefined,
			},
			"Workflow stage started",
		);

		expect(output()).toBe(
			"2026-05-21T10:00:00.000Z INFO  Workflow stage started projectId=api issueKey=ENG-1 retry=2\n",
		);
	});

	it("filters logs using PIV_LOG_LEVEL", () => {
		const { logger, output } = createCapturedLogger({
			env: { PIV_LOG_LEVEL: "warn" },
		});

		logger.info("Hidden");
		logger.warn({ issueKey: "ENG-2" }, "Visible");

		expect(output()).toBe(
			"2026-05-21T10:00:00.000Z WARN  Visible issueKey=ENG-2\n",
		);
	});

	it("prints normalized error details below the log line", () => {
		const { logger, output } = createCapturedLogger();

		logger.error({ err: normalizeError(new Error("Boom")) }, "Failed");

		const text = output();
		expect(text).toContain("ERROR Failed\n");
		expect(text).toContain("  error name=Error message=Boom\n");
		expect(text).toContain("Error: Boom");
	});
});

function createCapturedLogger(
	options: { env?: { PIV_LOG_LEVEL?: string } } = {},
) {
	let text = "";
	return {
		logger: createLogger({
			color: false,
			env: options.env ?? {},
			now: () => new Date("2026-05-21T10:00:00.000Z"),
			stderr: {
				write(chunk: string) {
					text += chunk;
				},
			},
		}),
		output: () => text,
	};
}
