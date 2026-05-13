import type {
	PollingConfig,
	ResolvedProjectConfig,
} from "../../features/types";
import type { LoadedConfig } from "./config.types";
import {
	buildEnvBase,
	buildEnvNotifications,
	buildEnvPolling,
	loadResolvedEnv,
} from "./env";
import { resolveNotifications } from "./notification-resolution";
import {
	assertNoProjectNotifications,
	assertNoProjectPolling,
	loadConfigOverride,
	normalizeOverrideToRoot,
} from "./overrides";
import { resolveProjects } from "./project-resolution";
import { loadSqliteEnv, saveSqliteEnv, sqliteEnvDbPath } from "./sqlite-env";
import {
	validateNotifications,
	validatePolling,
	validateProjects,
} from "./validation";

export async function loadConfig(cwd: string): Promise<LoadedConfig> {
	const env = await loadResolvedEnv(cwd);
	const envBase = buildEnvBase(cwd, env);
	const envPolling = buildEnvPolling(env);
	const envNotifications = buildEnvNotifications(env);
	const loadedOverride = await loadConfigOverride(cwd);
	const root = normalizeOverrideToRoot(loadedOverride);
	assertNoProjectPolling(root.projects);
	assertNoProjectNotifications(root.projects);

	const projects = resolveProjects(cwd, envBase, root);
	const polling = resolvePolling(envPolling, root.polling);
	const notifications = resolveNotifications(
		envNotifications,
		root.notifications,
	);

	validateProjects(projects);
	validatePolling(polling);
	validateNotifications(notifications);

	return { projects, polling, notifications };
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
export type { LoadedConfig } from "./config.types";
