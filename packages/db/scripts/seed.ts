import {
	agentsTable,
	boardProjectsTable,
	boardTasksTable,
	initializeServerDatabase,
	projectBoardsTable,
	skillsTable,
} from "../src";
import type { ServerDb } from "../src";
import {
	parseDatabaseScriptArgs,
	printCliError,
	resolveDatabaseConfig,
} from "./cli";

const SEED_NOW = "2026-05-20T00:00:00.000Z";

export interface SeedDatabaseOptions {
	dbPath?: string;
	port?: number;
}

export interface SeedDatabaseResult {
	dbPath: string;
	port: number;
}

if (import.meta.main) {
	try {
		const result = await runSeedDatabaseCli(process.argv.slice(2));
		if (result) {
			console.log(`Seeded ${result.dbPath}`);
		}
	} catch (error) {
		printCliError(error);
	}
}

export async function runSeedDatabaseCli(
	rawArgs: string[],
): Promise<SeedDatabaseResult | undefined> {
	const args = parseDatabaseScriptArgs(rawArgs);
	if (args.help) {
		printHelp();
		return undefined;
	}
	return seedDatabase({ dbPath: args.dbPath });
}

export async function seedDatabase(
	options: SeedDatabaseOptions = {},
): Promise<SeedDatabaseResult> {
	const { dbPath, port } = await resolveDatabaseConfig(options.dbPath, {
		port: options.port,
	});
	const database = await initializeServerDatabase(dbPath, { port });
	try {
		await insertSeedRows(database.db);
		return { dbPath, port };
	} finally {
		await database.close();
	}
}

async function insertSeedRows(db: ServerDb) {
	await db
		.insert(projectBoardsTable)
		.values({
			id: "dev-board",
			name: "Dev Board",
			description: "Local development board",
			ownerId: "dev-owner",
			createdAt: SEED_NOW,
			updatedAt: SEED_NOW,
		})
		.onConflictDoNothing();
	await db
		.insert(boardProjectsTable)
		.values({
			id: "dev-project",
			boardId: "dev-board",
			externalProjectId: "dev-project",
			name: "Dev Project",
			emoji: "🧭",
			description: "Local development project",
			repoOwner: "devos",
			repoName: "show-me-ur-agents",
			baseBranch: "main",
			localFolder: process.cwd(),
			lead: "dev-owner",
			category: "development",
			priority: 2,
			ownerId: "dev-owner",
			createdAt: SEED_NOW,
			updatedAt: SEED_NOW,
		})
		.onConflictDoNothing();
	await db
		.insert(agentsTable)
		.values({
			id: "dev-agent",
			name: "Dev Agent",
			description: "Local development agent",
			logo: "https://example.com/dev-agent.svg",
			runtime: "codex",
			backend: "codex",
			model: "gpt-5",
			concurrency: 1,
			owner: "dev-owner",
			createdAt: SEED_NOW,
			updatedAt: SEED_NOW,
			skills: JSON.stringify(["dev"]),
			recentWork: JSON.stringify([]),
			activity: JSON.stringify(["seeded"]),
			instructions: "Use this agent for local development data.",
		})
		.onConflictDoNothing();
	await db
		.insert(skillsTable)
		.values({
			id: "dev-skill",
			name: "dev",
			description: "Local development skill",
			source: "seed",
			updatedAt: SEED_NOW,
		})
		.onConflictDoNothing();
	await db
		.insert(boardTasksTable)
		.values({
			id: "dev-task",
			taskKey: "DEV-1",
			projectId: "dev-project",
			title: "Explore devos.ing",
			content: "Seeded task for local development.",
			priority: 2,
			status: "todo",
			dueDate: null,
			creatorId: "dev-owner",
			linkedPr: null,
			createdAt: SEED_NOW,
			updatedAt: SEED_NOW,
		})
		.onConflictDoNothing();
}

function printHelp(): void {
	console.log(`Seed a devos-db database with deterministic local data.

Usage:
  bun run --filter devos-db seed -- [--db PATH]

Options:
  --db <path>  Embedded PostgreSQL data directory
  --help, -h   Show this help`);
}
