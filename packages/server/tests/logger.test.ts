import { describe, expect, it } from "bun:test";
import { ServerDatabaseInitializationError } from "../src/db";
import { normalizeError } from "../src/logger";

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
});
