import { describe, expect, it } from "bun:test";
import { ServerDatabaseInitializationError } from "devos-db";
import { createServerLogger, normalizeError } from "../src/logger";

describe("server logger", () => {
	it("normalizes server database initialization details", () => {
		const cause = new Error("Aborted");
		const error = new ServerDatabaseInitializationError({
			cause,
			databasePath: "/tmp/server-db",
			phase: "wait_ready",
		});

		expect(normalizeError(error)).toMatchObject({
			name: "ServerDatabaseInitializationError",
			message:
				"Failed to initialize server database at /tmp/server-db during wait_ready: Aborted",
			databasePath: "/tmp/server-db",
			phase: "wait_ready",
			cause: {
				name: "Error",
				message: "Aborted",
			},
		});
	});

	it("supports warning logs with human context fields", () => {
		let output = "";
		const logger = createServerLogger({
			color: false,
			env: {},
			now: () => new Date("2026-05-21T10:00:00.000Z"),
			stderr: {
				write(chunk: string) {
					output += chunk;
				},
			},
		});

		logger.warn({ jobId: "daily", skipped: true }, "Skipping cron run");

		expect(output).toBe(
			"2026-05-21T10:00:00.000Z WARN  Skipping cron run jobId=daily skipped=true\n",
		);
	});
});
