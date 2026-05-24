import { mkdir } from "node:fs/promises";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { runMigrations } from "../src/migrations";
import {
	parseDatabaseScriptArgs,
	printCliError,
	resolveDatabasePath,
} from "./cli";

export interface MigrateDatabaseOptions {
	dbPath?: string;
}

export interface MigrateDatabaseResult {
	dbPath: string;
}

if (import.meta.main) {
	try {
		const result = await runMigrateDatabaseCli(process.argv.slice(2));
		if (result) {
			console.log(`Migrated ${result.dbPath}`);
		}
	} catch (error) {
		printCliError(error);
	}
}

export async function runMigrateDatabaseCli(
	rawArgs: string[],
): Promise<MigrateDatabaseResult | undefined> {
	const args = parseDatabaseScriptArgs(rawArgs);
	if (args.help) {
		printHelp();
		return undefined;
	}
	return migrateDatabase({ dbPath: args.dbPath });
}

export async function migrateDatabase(
	options: MigrateDatabaseOptions = {},
): Promise<MigrateDatabaseResult> {
	const dbPath = await resolveDatabasePath(options.dbPath);
	await mkdir(path.dirname(dbPath), { recursive: true });
	const client = new PGlite(dbPath);
	try {
		await client.waitReady;
		await runMigrations(client);
		return { dbPath };
	} finally {
		await client.close();
	}
}

function printHelp(): void {
	console.log(`Run devos-db migrations.

Usage:
  bun run --filter devos-db migrate -- [--db PATH]

Options:
  --db <path>  PGlite database path
  --help, -h   Show this help`);
}
