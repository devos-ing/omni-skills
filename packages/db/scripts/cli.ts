import path from "node:path";
import { readOptionValue } from "../../../scripts/script-args";
export { readOptionValue } from "../../../scripts/script-args";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");
const DEFAULT_DB_PATH = path.join(REPO_ROOT, ".devos", "config", "server-db");

export interface DatabaseScriptArgs {
	dbPath?: string;
	help: boolean;
}

export function parseDatabaseScriptArgs(rawArgs: string[]): DatabaseScriptArgs {
	const parsed: DatabaseScriptArgs = { help: false };
	for (let index = 0; index < rawArgs.length; index += 1) {
		const arg = rawArgs[index];
		if (arg === "--help" || arg === "-h") {
			parsed.help = true;
			continue;
		}
		if (arg === "--db") {
			parsed.dbPath = readOptionValue(rawArgs, index, arg);
			index += 1;
			continue;
		}
		throw new Error(`Unknown option: ${arg}`);
	}
	return parsed;
}

export function resolveDatabasePath(dbPath: string | undefined): string {
	return path.resolve(
		dbPath || process.env.PIV_SERVER_DATABASE_PATH || DEFAULT_DB_PATH,
	);
}

export function printCliError(error: unknown): never {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}
