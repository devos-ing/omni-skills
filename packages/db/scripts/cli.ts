import { readFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readOptionValue } from "../../../scripts/script-args";
export { readOptionValue } from "../../../scripts/script-args";

const REPO_ROOT = path.resolve(import.meta.dir, "..", "..", "..");
const DEFAULT_DB_PATH = path.join(REPO_ROOT, ".devos", "config", "server-db");
const INSTANCE_CONFIG_FILE = "instance.config.json";

export interface ResolveDatabasePathOptions {
	env?: NodeJS.ProcessEnv;
	readText?: (targetPath: string, encoding: BufferEncoding) => Promise<string>;
}

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

export async function resolveDatabasePath(
	dbPath: string | undefined,
	options: ResolveDatabasePathOptions = {},
): Promise<string> {
	const env = options.env ?? process.env;
	const explicitPath = normalizeOptionalValue(dbPath);
	if (explicitPath) {
		return path.resolve(explicitPath);
	}
	const envPath = normalizeOptionalValue(env.PIV_SERVER_DATABASE_PATH);
	if (envPath) {
		return path.resolve(envPath);
	}
	const instancePath = await loadInstanceDatabasePath(options);
	if (instancePath) {
		return path.resolve(instancePath);
	}
	return DEFAULT_DB_PATH;
}

export function printCliError(error: unknown): never {
	console.error(error instanceof Error ? error.message : String(error));
	process.exit(1);
}

async function loadInstanceDatabasePath(
	options: ResolveDatabasePathOptions,
): Promise<string | undefined> {
	const env = options.env ?? process.env;
	const readText = options.readText ?? readFile;
	let content: string;
	try {
		content = await readText(instanceConfigPath(env), "utf8");
	} catch {
		return undefined;
	}
	let parsed: unknown;
	try {
		parsed = JSON.parse(content);
	} catch {
		return undefined;
	}
	if (!isRecord(parsed) || !isRecord(parsed.database)) {
		return undefined;
	}
	const dataDir = parsed.database.embeddedPostgresDataDir;
	return typeof dataDir === "string"
		? normalizeOptionalValue(dataDir)
		: undefined;
}

function instanceConfigPath(env: NodeJS.ProcessEnv): string {
	const home = normalizeOptionalValue(env.HOME) ?? os.homedir();
	return path.join(home, ".devos", "config", INSTANCE_CONFIG_FILE);
}

function normalizeOptionalValue(value: string | undefined): string | undefined {
	const trimmed = value?.trim();
	return trimmed ? trimmed : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
