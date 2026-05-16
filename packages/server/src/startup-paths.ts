import path from "node:path";
import type { ServerStartupConfig } from "./startup-paths.types";

export function resolveDefaultServerWorkspacePath(): string {
	return path.resolve(import.meta.dir, "..", "..", "..");
}

export function resolveServerWorkspacePath(
	env: NodeJS.ProcessEnv,
	defaultWorkspacePath = resolveDefaultServerWorkspacePath(),
): string {
	return path.resolve(env.PIV_WORKSPACE_PATH ?? defaultWorkspacePath);
}

export function resolveServerDatabasePath(
	env: NodeJS.ProcessEnv,
	workspacePath: string,
	config: ServerStartupConfig,
): string {
	const explicitDatabasePath = env.PIV_SERVER_DATABASE_PATH?.trim();
	if (explicitDatabasePath) {
		return path.isAbsolute(explicitDatabasePath)
			? explicitDatabasePath
			: path.resolve(workspacePath, explicitDatabasePath);
	}

	const defaultProjectDatabasePath =
		config.projects[0]?.server.database.databasePath;
	if (!defaultProjectDatabasePath) {
		throw new Error("Server database path could not be resolved from config");
	}
	return defaultProjectDatabasePath;
}
