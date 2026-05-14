import path from "node:path";
import {
	CliCommandExecutor,
	initializeServerDatabase,
} from "adhdai/features/server";
import { createHandleRequest } from "./app";
import { initializeServerDatabase } from "./db";

const DEFAULT_SERVER_DB_PATH = ".piv-loop/server/db";

export const startServer = async (
	port = 3000,
): Promise<Bun.Server<undefined>> => {
	const serverDatabase = await initializeServerDatabase(
		process.env.SERVER_DB_PATH ?? DEFAULT_SERVER_DB_PATH,
	);
	return Bun.serve({
		port,
		fetch: createHandleRequest({
			cliExecutor: new CliCommandExecutor({
				cwd: process.cwd(),
				command: "bun",
				baseArgs: ["run", "./packages/cli/src/index.ts"],
			}),
			db: serverDatabase.db,
		}),
	});
};

if (import.meta.main) {
	await startServer();
}
