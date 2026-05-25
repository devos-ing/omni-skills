import type {
	DevosRootConfig,
	PollingConfig,
	ResolvedProjectConfig,
} from "../types";
import {
	buildEnvBase,
	buildEnvNotifications,
	buildEnvPolling,
	loadResolvedEnv,
} from "./env";
import { normalizeOptionalValue } from "./env-normalizers";
import {
	loadInstanceServerDatabaseConfig,
	loadInstanceServerDatabasePath,
} from "./instance-database-path";
import { loadInstanceWorkspaceConfig } from "./instance-workspace";
import { resolveNotifications } from "./notification-resolution";
import { applyInstancePlugins } from "./plugin-resolution";
import { applyServerProjectMetadata } from "./project-metadata";
import { resolveProjects } from "./project-resolution";
import { resolveRootServerConfig } from "./server-resolution";
import { loadSqliteEnv, saveSqliteEnv, sqliteEnvDbPath } from "./sqlite-env";
import type { LoadedConfig } from "./types/config.types";
import {
	validateNotifications,
	validatePolling,
	validateProjects,
} from "./validation";

interface LoadConfigOptions {
	applyServerProjectMetadata: boolean;
}

export async function loadConfig(cwd: string): Promise<LoadedConfig> {
	return loadConfigWithOptions(cwd, { applyServerProjectMetadata: true });
}

export async function loadServerStartupConfig(
	cwd: string,
): Promise<LoadedConfig> {
	return loadConfigWithOptions(cwd, {
		applyServerProjectMetadata: false,
	});
}

async function loadConfigWithOptions(
	cwd: string,
	options: LoadConfigOptions,
): Promise<LoadedConfig> {
	const env = await loadResolvedEnv(cwd);
	const instanceServerDatabase = normalizeOptionalValue(
		env.PIV_SERVER_DATABASE_PATH,
	)
		? undefined
		: await loadInstanceServerDatabaseConfig();
	const envBase = buildEnvBase(cwd, env, instanceServerDatabase);
	const envPolling = buildEnvPolling(env);
	const envNotifications = buildEnvNotifications(env);
	const workspace = await loadInstanceWorkspaceConfig();
	const root = createRuntimeRootConfig();
	const defaultProjectRoot = createDefaultProjectRootConfig();

	const resolvedProjects = resolveProjects(cwd, envBase, root);
	const metadataProjects = options.applyServerProjectMetadata
		? await applyServerProjectMetadata(resolvedProjects, {
				configCwd: cwd,
				base: envBase,
				root,
			})
		: resolvedProjects;
	const projectsWithoutPlugins =
		metadataProjects.length > 0
			? metadataProjects
			: resolveProjects(cwd, envBase, defaultProjectRoot);
	const projects = await applyInstancePlugins(projectsWithoutPlugins);
	const polling = resolvePolling(envPolling, root.polling);
	const notifications = resolveNotifications(
		envNotifications,
		root.notifications,
	);
	const server = resolveRootServerConfig(cwd, envBase, root);

	validateProjects(projects);
	validatePolling(polling);
	validateNotifications(notifications);

	return { projects, server, polling, notifications, workspace };
}

function createRuntimeRootConfig(): DevosRootConfig {
	return { projects: [] };
}

function createDefaultProjectRootConfig(): DevosRootConfig {
	return { projects: [{ id: "default" }] };
}

export function getProjectById(
	config: LoadedConfig,
	projectId: string,
): ResolvedProjectConfig | undefined {
	return config.projects.find((project) => project.id === projectId);
}

function resolvePolling(
	base: PollingConfig,
	override: Partial<PollingConfig> | undefined,
): PollingConfig {
	return { ...base, ...(override ?? {}) };
}

export { loadSqliteEnv, saveSqliteEnv, sqliteEnvDbPath };
export {
	devosHomeConfigDir,
	devosHomeDir,
	devosHomeInstanceRoot,
	instanceConfigPath,
} from "./home-paths";
export { loadInstanceServerDatabaseConfig, loadInstanceServerDatabasePath };
export { loadInstanceWorkspaceConfig };
export { loadResolvedEnv };
export type { LoadedConfig } from "./types/config.types";
export type { ResolvedEnv } from "./env";
