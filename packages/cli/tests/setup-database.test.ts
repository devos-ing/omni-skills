import { describe, expect, it } from "bun:test";
import { access, mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { initializeServerDatabase } from "devos-db";
import {
	DEFAULT_LABEL_MAP,
	DEFAULT_REASONING_EFFORTS,
	DEFAULT_STATUS_MAP,
	LOCAL_BOARD_ID,
	type SetupDraft,
	writeSetupFiles,
} from "../src/features/setup";

const draft: SetupDraft = {
	workspaceName: "Demo Workspace",
	workspacePath: "/tmp/demo",
	executionPath: "/tmp/demo",
	linearApiKey: "lin_secret_123",
	notifications: {
		email: {
			enabled: false,
			to: [],
		},
	},
	statusMap: DEFAULT_STATUS_MAP,
	labelMap: DEFAULT_LABEL_MAP,
	codex: {
		reasoningEfforts: {
			plan: DEFAULT_REASONING_EFFORTS.plan,
			implement: DEFAULT_REASONING_EFFORTS.implement,
			reviewTest: DEFAULT_REASONING_EFFORTS.reviewTest,
			githubComment: DEFAULT_REASONING_EFFORTS.reviewTest,
		},
		models: {
			plan: "gpt-5.5",
			implement: "gpt-5.3-codex",
			reviewTest: "gpt-5.3-codex",
			githubComment: "gpt-5.3-codex",
		},
		plugins: ["github@openai-curated", "linear@openai-curated"],
		skillsets: ["devos"],
		configOverrides: { "features.codex_hooks": "true" },
		sandbox: "workspace-write",
	},
};

describe("setup database initialization", () => {
	it("creates and migrates the server database during fresh onboarding", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-db-"));
		const databasePath = path.join(tempDir, ".devos", "config", "server-db");

		try {
			await expect(access(databasePath)).rejects.toThrow();
			await writeSetupFiles(tempDir, draft);
			await access(databasePath);

			const database = await initializeServerDatabase(databasePath);
			try {
				const migrations = await database.client.query<{ id: string }>(
					"SELECT id FROM schema_migrations ORDER BY id",
				);
				const boards = await database.client.query<{
					id: string;
					name: string;
				}>("SELECT id, name FROM project_boards WHERE id = $1", [
					LOCAL_BOARD_ID,
				]);

				expect(migrations.rows.map((row) => row.id)).toContain(
					"0011_project_metadata",
				);
				expect(boards.rows).toEqual([
					{ id: LOCAL_BOARD_ID, name: draft.workspaceName },
				]);
			} finally {
				await database.close();
			}
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});

	it("reruns onboarding database initialization without duplicates", async () => {
		const tempDir = await mkdtemp(path.join(process.cwd(), ".tmp-setup-db-"));
		try {
			await writeSetupFiles(tempDir, draft);
			await writeSetupFiles(tempDir, {
				...draft,
				workspaceName: "Renamed Workspace",
			});

			const database = await initializeServerDatabase(
				path.join(tempDir, ".devos", "config", "server-db"),
			);
			try {
				const boardCounts = await database.client.query<{ count: number }>(
					"SELECT COUNT(*)::int AS count FROM project_boards WHERE id = $1",
					[LOCAL_BOARD_ID],
				);
				const migrationCounts = await database.client.query<{
					count: number;
					distinct_count: number;
				}>(
					"SELECT COUNT(*)::int AS count, COUNT(DISTINCT id)::int AS distinct_count FROM schema_migrations",
				);
				const boards = await database.client.query<{ name: string }>(
					"SELECT name FROM project_boards WHERE id = $1",
					[LOCAL_BOARD_ID],
				);

				expect(Number(boardCounts.rows[0]?.count)).toBe(1);
				expect(Number(migrationCounts.rows[0]?.count)).toBe(
					Number(migrationCounts.rows[0]?.distinct_count),
				);
				expect(boards.rows[0]?.name).toBe("Renamed Workspace");
			} finally {
				await database.close();
			}
		} finally {
			await rm(tempDir, { recursive: true, force: true });
		}
	});
});
