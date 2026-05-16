import { describe, expect, it, mock } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { ServerDatabaseInitializationError } from "../src/db";
import { initializeServerDatabaseWithDependencies } from "../src/db/database";

describe("server database initialization", () => {
	it("passes PGlite debug options to the client factory", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-init-"));
		const close = mock(async () => {});
		const exec = mock(async () => []);
		const migrationRunner = mock(async () => {});
		let debugOption: unknown;

		const database = await initializeServerDatabaseWithDependencies(
			path.join(tempDir, "db"),
			{ pgliteDebug: 1 },
			{
				clientFactory: (_databasePath, options) => {
					debugOption = options.pgliteDebug;
					return {
						closed: false,
						close,
						exec,
						waitReady: Promise.resolve(),
					} as unknown as PGlite;
				},
				migrationRunner,
			},
		);

		await database.close();
		await rm(tempDir, { recursive: true, force: true });

		expect(debugOption).toBe(1);
		expect(exec).toHaveBeenCalledTimes(1);
		expect(migrationRunner).toHaveBeenCalledTimes(1);
		expect(close).toHaveBeenCalledTimes(1);
	});

	it("wraps readiness failures with phase and database path", async () => {
		const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-init-"));
		const databasePath = path.join(tempDir, "db");
		const close = mock(async () => {});
		const cause = new Error("ready failed");

		try {
			await initializeServerDatabaseWithDependencies(
				databasePath,
				{},
				{
					clientFactory: () =>
						({
							closed: false,
							close,
							waitReady: Promise.reject(cause),
						}) as unknown as PGlite,
				},
			);
			throw new Error("Expected initializeServerDatabase to fail");
		} catch (error) {
			expect(error).toBeInstanceOf(ServerDatabaseInitializationError);
			expect((error as ServerDatabaseInitializationError).phase).toBe(
				"wait_ready",
			);
			expect((error as ServerDatabaseInitializationError).databasePath).toBe(
				path.resolve(databasePath),
			);
			expect((error as Error).cause).toBe(cause);
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}

		expect(close).toHaveBeenCalledTimes(1);
	});
});
