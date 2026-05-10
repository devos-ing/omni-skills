import { Database } from "bun:sqlite";
import { access, mkdir } from "node:fs/promises";
import path from "node:path";
import {
	SQLITE_ENV_DB_FILE,
	SQLITE_ENV_DIR,
	SQLITE_ENV_TABLE,
} from "./constants";

export function sqliteEnvDbPath(cwd: string): string {
	return path.join(cwd, SQLITE_ENV_DIR, SQLITE_ENV_DB_FILE);
}

export async function loadSqliteEnv(
	cwd: string,
): Promise<Record<string, string> | undefined> {
	const dbPath = sqliteEnvDbPath(cwd);
	try {
		await access(dbPath);
	} catch {
		return undefined;
	}

	const db = new Database(dbPath, { readonly: true, create: false });
	try {
		const rows = db
			.query(`SELECT key, value FROM ${SQLITE_ENV_TABLE}`)
			.all() as Array<{ key: string; value: string }>;
		const loaded: Record<string, string> = {};
		for (const row of rows) {
			loaded[row.key] = row.value;
		}
		return loaded;
	} finally {
		db.close(false);
	}
}

export async function saveSqliteEnv(
	cwd: string,
	updates: Record<string, string | undefined>,
): Promise<void> {
	const dbPath = sqliteEnvDbPath(cwd);
	await mkdir(path.dirname(dbPath), { recursive: true });
	const db = new Database(dbPath, { create: true });
	try {
		db.run(
			`CREATE TABLE IF NOT EXISTS ${SQLITE_ENV_TABLE} (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL)`,
		);
		const upsert = db.query(
			`INSERT INTO ${SQLITE_ENV_TABLE} (key, value, updated_at)
			 VALUES (?1, ?2, ?3)
			 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
		);
		const remove = db.query(`DELETE FROM ${SQLITE_ENV_TABLE} WHERE key = ?1`);
		const now = new Date().toISOString();
		for (const [key, value] of Object.entries(updates)) {
			if (value === undefined) {
				remove.run(key);
				continue;
			}
			upsert.run(key, value, now);
		}
	} finally {
		db.close(false);
	}
}
