import path from "node:path";
import { CliCommandExecutor } from "adhdai/features/server/cli-command-executor";
import { createHandleRequest } from "./app";
import { initializeServerDatabase } from "./db";

const DEFAULT_SERVER_DATABASE_PATH = ".piv-loop/config/server-db";

function resolveServerDatabasePath(cwd = process.cwd()): string {
	return (
		process.env.PIV_SERVER_DATABASE_PATH ??
		path.join(cwd, DEFAULT_SERVER_DATABASE_PATH)
	);
}

export async function startServer(port = 3000): Promise<Bun.Server<undefined>> {
	const persistence = await initializeServerDatabase(
		resolveServerDatabasePath(),
	);

	return Bun.serve({
		port,
		fetch: createHandleRequest({
			persistence,
			cliExecutor: new CliCommandExecutor({
				cwd: process.cwd(),
				command: "bun",
				baseArgs: ["run", "./packages/cli/src/index.ts"],
			}),
		}),
	});
}

if (import.meta.main) {
	await startServer();
}
