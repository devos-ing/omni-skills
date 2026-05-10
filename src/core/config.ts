import { resolveAutomations } from "./config/cron-resolution";
import {
	buildEnvBase,
	buildEnvNotifications,
	buildEnvPolling,
	loadResolvedEnv,
} from "./config/env";
import { resolveNotifications } from "./config/notification-resolution";
import {
	assertNoProjectNotifications,
	assertNoProjectPolling,
	loadConfigOverride,
	normalizeOverrideToRoot,
} from "./config/overrides";
import { resolveProjects } from "./config/project-resolution";
import {
	loadSqliteEnv,
	saveSqliteEnv,
	sqliteEnvDbPath,
} from "./config/sqlite-env";
import {
	validateCron,
	validateNotifications,
	validatePolling,
	validateProjects,
} from "./config/validation";
import type { PollingConfig, ResolvedProjectConfig } from "./types";

export interface LoadedConfig {
	projects: ResolvedProjectConfig[];
	polling: PollingConfig;
	automations: ReturnType<typeof resolveAutomations>;
	cron: ReturnType<typeof resolveAutomations>;
	notifications: ReturnType<typeof resolveNotifications>;
}

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
	const automations = resolveAutomations(root.automations, root.cron);
	const cron = automations;
	const notifications = resolveNotifications(
		envNotifications,
		root.notifications,
	);

	validateProjects(projects);
	validatePolling(polling);
	validateCron(automations);
	validateNotifications(notifications);

	return { projects, polling, automations, cron, notifications };
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
