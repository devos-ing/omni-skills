import { afterEach, describe, expect, it } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import {
	boardProjectsTable,
	boardTasksTable,
	chatSessionsTable,
} from "devos-db/schema";
import { backupDatabase } from "../scripts/backup";
import { resolveDatabaseConfig, resolveDatabasePath } from "../scripts/cli";
import { migrateDatabase } from "../scripts/migrate";
import { seedDatabase } from "../scripts/seed";
import { initializeServerDatabase } from "../src";
import { projectBoardsTable } from "../src/schema";

const tempDirs: string[] = [];
const EMBEDDED_POSTGRES_TEST_TIMEOUT_MS = 20_000;

afterEach(async () => {
	await Promise.all(
		tempDirs
			.splice(0)
			.map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("database scripts", () => {
	it(
		"runs migrations for a fresh server database",
		async () => {
			const dbPath = await createDatabasePath();
			const port = await createDatabasePort();

			const result = await migrateDatabase({ dbPath, port });

			expect(result.dbPath).toBe(dbPath);
			expect(result.port).toBe(port);
			const database = await initializeServerDatabase(dbPath, {
				port,
				runMigrations: false,
			});
			try {
				const migrations = await database.client.query<{ id: string }>(
					"SELECT id FROM schema_migrations ORDER BY id",
				);
				expect(migrations.rows.length).toBeGreaterThan(0);
				expect(migrations.rows.at(-1)?.id).toBe("0014_chat_session_task_id");
				const columns = await database.client.query<{ column_name: string }>(
					`
						SELECT column_name
						FROM information_schema.columns
						WHERE table_name = 'chat_sessions' AND column_name = 'task_id'
					`,
				);
				expect(columns.rows).toHaveLength(1);
			} finally {
				await database.close();
			}
		},
		EMBEDDED_POSTGRES_TEST_TIMEOUT_MS,
	);

	it(
		"seeds deterministic dev data idempotently",
		async () => {
			const dbPath = await createDatabasePath();
			const port = await createDatabasePort();

			await seedDatabase({ dbPath, port });
			await seedDatabase({ dbPath, port });

			const database = await initializeServerDatabase(dbPath, { port });
			try {
				const boards = await database.db.select().from(projectBoardsTable);
				expect(boards.filter((board) => board.id === "dev-board")).toHaveLength(
					1,
				);
			} finally {
				await database.close();
			}
		},
		EMBEDDED_POSTGRES_TEST_TIMEOUT_MS,
	);

	it(
		"copies a timestamped backup without mutating the source",
		async () => {
			const dbPath = await createDatabasePath();
			await migrateDatabase({ dbPath, port: await createDatabasePort() });

			const result = await backupDatabase({
				dbPath,
				now: new Date("2026-05-20T01:02:03.004Z"),
			});

			expect(result.sourcePath).toBe(dbPath);
			expect(result.backupPath).toBe(`${dbPath}.backup-20260520T010203004Z`);
			expect((await stat(dbPath)).isDirectory()).toBe(true);
			expect((await stat(result.backupPath)).isDirectory()).toBe(true);
			await expect(readMigrationCount(dbPath)).resolves.toBeGreaterThan(0);
			await expect(
				readMigrationCount(result.backupPath),
			).resolves.toBeGreaterThan(0);
		},
		EMBEDDED_POSTGRES_TEST_TIMEOUT_MS,
	);

	it("refuses to copy a live embedded PostgreSQL cluster", async () => {
		const dbPath = await createDatabasePath();
		try {
			await mkdir(dbPath, { recursive: true });
			await writeFile(path.join(dbPath, "postmaster.pid"), String(process.pid));
			await expect(backupDatabase({ dbPath })).rejects.toThrow(
				"Refusing to back up live embedded PostgreSQL cluster",
			);
		} finally {
			await rm(path.dirname(dbPath), { recursive: true, force: true });
		}
	});

	it("resolves database paths from explicit, env, instance, then repo fallback", async () => {
		let readCalls = 0;
		const readText = async (targetPath: string) => {
			readCalls += 1;
			expect(targetPath).toBe(
				path.join(
					"/tmp/devos-home",
					".devos",
					"config",
					"instance.config.json",
				),
			);
			return JSON.stringify({
				database: {
					embeddedPostgresDataDir: "/tmp/instance-db",
					embeddedPostgresPort: 54330,
				},
			});
		};

		await expect(
			resolveDatabasePath("/tmp/explicit-db", {
				env: {
					HOME: "/tmp/devos-home",
					PIV_SERVER_DATABASE_PATH: "/tmp/env-db",
				},
				readText,
			}),
		).resolves.toBe("/tmp/explicit-db");
		await expect(
			resolveDatabasePath(undefined, {
				env: {
					HOME: "/tmp/devos-home",
					PIV_SERVER_DATABASE_PATH: "/tmp/env-db",
				},
				readText,
			}),
		).resolves.toBe("/tmp/env-db");
		expect(readCalls).toBe(0);
		await expect(
			resolveDatabasePath(undefined, {
				env: { HOME: "/tmp/devos-home" },
				readText,
			}),
		).resolves.toBe("/tmp/instance-db");
		await expect(
			resolveDatabaseConfig(undefined, {
				env: { HOME: "/tmp/devos-home" },
				readText,
			}),
		).resolves.toEqual({
			dbPath: "/tmp/instance-db",
			port: 54330,
		});
		await expect(
			resolveDatabasePath(undefined, {
				env: { HOME: "/tmp/devos-home" },
				readText: async () => {
					throw new Error("missing");
				},
			}),
		).resolves.toBe(
			path.resolve(
				import.meta.dir,
				"..",
				"..",
				"..",
				".devos",
				"config",
				"server-db",
			),
		);
	});

	it("rejects invalid instance embedded PostgreSQL ports", async () => {
		await expect(
			resolveDatabaseConfig(undefined, {
				env: { HOME: "/tmp/devos-home" },
				readText: async () =>
					JSON.stringify({
						database: {
							embeddedPostgresDataDir: "/tmp/instance-db",
							embeddedPostgresPort: 0,
						},
					}),
			}),
		).rejects.toThrow("embeddedPostgresPort must be a positive integer port");
	});

	it("keeps schema package exports available", () => {
		expect(boardTasksTable).toBeDefined();
		expect(boardTasksTable.id).toBeDefined();
		expect(boardProjectsTable.repoName).toBeDefined();
		expect(chatSessionsTable.taskId).toBeDefined();
	});
});

async function createDatabasePath(): Promise<string> {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-db-test-"));
	tempDirs.push(tempDir);
	return path.join(tempDir, "server-db");
}

async function createDatabasePort(): Promise<number> {
	if (
		process.env.CODEX_SANDBOX === "seatbelt" ||
		process.env.CODEX_SANDBOX_NETWORK_DISABLED === "1"
	) {
		return 54329;
	}
	return new Promise((resolve) => {
		const server = createServer();
		server.once("error", () => resolve(54329));
		server.listen(0, "127.0.0.1", () => {
			const address = server.address();
			server.close(() => {
				if (typeof address === "object" && address?.port) {
					resolve(address.port);
					return;
				}
				resolve(54329);
			});
		});
	});
}

async function readMigrationCount(dbPath: string): Promise<number> {
	const database = await initializeServerDatabase(dbPath, {
		runMigrations: false,
	});
	try {
		const result = await database.client.query<{ count: string }>(
			"SELECT COUNT(*) AS count FROM schema_migrations",
		);
		return Number(result.rows[0]?.count ?? 0);
	} finally {
		await database.close();
	}
}
