import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { type ServerDatabase, initializeServerDatabase } from "../src/db";
export interface DrizzleServerTestDatabase {
	db: ServerDatabase["db"];
	path: string;
	cleanup(): Promise<void>;
}

export async function createDrizzleServerTestDatabase(): Promise<DrizzleServerTestDatabase> {
	const tempDir = await mkdtemp(path.join(os.tmpdir(), "adhd-server-pg-"));
	const databasePath = path.join(tempDir, "db");
	const serverDatabase = await initializeServerDatabase(databasePath);

	return {
		db: serverDatabase.db,
		path: databasePath,
		async cleanup() {
			await serverDatabase.close();
			await rm(tempDir, { recursive: true, force: true });
		},
	};
}
