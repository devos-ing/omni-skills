import { cp, mkdtemp, rename, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { initializeServerDatabase } from "devos-db";
import { readOptionValue } from "./script-args";

const REPO_ROOT = path.resolve(import.meta.dir, "..");
const DEFAULT_DB_PATH = path.join(REPO_ROOT, ".devos", "config", "server-db");

export interface RecoverServerDatabaseOptions {
	apply?: boolean;
	dbPath?: string;
	now?: Date;
	validateDatabase?: (databasePath: string) => Promise<void>;
}

export interface RecoverServerDatabaseResult {
	applied: boolean;
	backupPath?: string;
	sourcePath: string;
}

interface ParsedArgs {
	apply: boolean;
	dbPath?: string;
	help: boolean;
}

if (import.meta.main) {
	try {
		const result = await runRecoverServerDatabaseCli(process.argv.slice(2));
		if (result) {
			printResult(result);
		}
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	}
}

export async function runRecoverServerDatabaseCli(
	rawArgs: string[],
): Promise<RecoverServerDatabaseResult | undefined> {
	const args = parseArgs(rawArgs);
	if (args.help) {
		printHelp();
		return undefined;
	}
	return recoverServerDatabase({
		apply: args.apply,
		dbPath: args.dbPath,
	});
}

export async function recoverServerDatabase(
	options: RecoverServerDatabaseOptions = {},
): Promise<RecoverServerDatabaseResult> {
	const sourcePath = path.resolve(
		options.dbPath ?? process.env.PIV_SERVER_DATABASE_PATH ?? DEFAULT_DB_PATH,
	);
	const validateDatabase = options.validateDatabase ?? validateServerDatabase;
	await ensureDirectory(sourcePath);

	const tempDir = await mkdtemp(path.join(os.tmpdir(), "devos-server-db-"));
	const validatedCopyPath = path.join(tempDir, "server-db");

	try {
		await cp(sourcePath, validatedCopyPath, { recursive: true });
		await validateCopiedDatabase({
			sourcePath,
			validateDatabase,
			validatedCopyPath,
		});

		if (!options.apply) {
			return { applied: false, sourcePath };
		}

		const backupPath = await createBackupPath(sourcePath, options.now);
		await rename(sourcePath, backupPath);
		await restoreValidatedCopy({
			backupPath,
			sourcePath,
			validateDatabase,
			validatedCopyPath,
		});
		return { applied: true, backupPath, sourcePath };
	} finally {
		await rm(tempDir, { recursive: true, force: true });
	}
}

async function restoreValidatedCopy(input: {
	backupPath: string;
	sourcePath: string;
	validateDatabase: (databasePath: string) => Promise<void>;
	validatedCopyPath: string;
}): Promise<void> {
	try {
		await cp(input.validatedCopyPath, input.sourcePath, { recursive: true });
		await input.validateDatabase(input.sourcePath);
	} catch (error) {
		await rm(input.sourcePath, { recursive: true, force: true });
		await cp(input.backupPath, input.sourcePath, { recursive: true });
		throw error;
	}
}

async function validateCopiedDatabase(input: {
	sourcePath: string;
	validateDatabase: (databasePath: string) => Promise<void>;
	validatedCopyPath: string;
}): Promise<void> {
	try {
		await input.validateDatabase(input.validatedCopyPath);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new Error(
			`Copied server database validation failed for ${input.sourcePath} using temporary copy ${input.validatedCopyPath}: ${message}`,
			{ cause: error },
		);
	}
}

async function validateServerDatabase(databasePath: string): Promise<void> {
	const database = await initializeServerDatabase(databasePath);
	await database.close();
}

async function ensureDirectory(directoryPath: string): Promise<void> {
	const stats = await stat(directoryPath);
	if (!stats.isDirectory()) {
		throw new Error(
			`Server database path is not a directory: ${directoryPath}`,
		);
	}
}

async function createBackupPath(
	sourcePath: string,
	now = new Date(),
): Promise<string> {
	const parent = path.dirname(sourcePath);
	const baseName = path.basename(sourcePath);
	const timestamp = formatBackupTimestamp(now);
	for (let index = 0; index < 100; index += 1) {
		const suffix = index === 0 ? "" : `-${index}`;
		const candidate = path.join(
			parent,
			`${baseName}.backup-${timestamp}${suffix}`,
		);
		if (!(await pathExists(candidate))) {
			return candidate;
		}
	}
	throw new Error(`Unable to create unique backup path for ${sourcePath}`);
}

async function pathExists(filePath: string): Promise<boolean> {
	try {
		await stat(filePath);
		return true;
	} catch {
		return false;
	}
}

function parseArgs(rawArgs: string[]): ParsedArgs {
	const parsed: ParsedArgs = { apply: false, help: false };
	for (let index = 0; index < rawArgs.length; index += 1) {
		const arg = rawArgs[index];
		if (arg === "--help" || arg === "-h") {
			parsed.help = true;
		} else if (arg === "--apply") {
			parsed.apply = true;
		} else if (arg === "--db") {
			parsed.dbPath = readOptionValue(rawArgs, index, arg);
			index += 1;
		} else {
			throw new Error(`Unknown option: ${arg}`);
		}
	}
	return parsed;
}

function formatBackupTimestamp(date: Date): string {
	return date.toISOString().replace(/[-:.]/g, "");
}

function printResult(result: RecoverServerDatabaseResult): void {
	if (!result.applied) {
		console.log(`Dry run succeeded for ${result.sourcePath}`);
		return;
	}
	console.log(`Recovered ${result.sourcePath}`);
	console.log(`Backup retained at ${result.backupPath}`);
}

function printHelp(): void {
	console.log(`Usage: bun run db:recover -- [--db PATH] [--apply]

Without --apply, validates a copied server database and leaves the original unchanged.
With --apply, retains a sibling backup and replaces the original from the validated copy.`);
}
