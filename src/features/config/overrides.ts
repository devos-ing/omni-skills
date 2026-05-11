import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import type {
	AdhdAiRootConfig,
	DeepPartial,
	ProjectConfig,
	ProjectRuntimeConfig,
} from "../../core/types";
import {
	DEFAULT_CONFIG_FILE,
	LEGACY_CONFIG_FILE,
	LOCAL_CONFIG_FILE,
} from "./constants";

type RootOverride = DeepPartial<AdhdAiRootConfig>;
type LegacyOverride = DeepPartial<ProjectRuntimeConfig>;
type AnyOverride = RootOverride | LegacyOverride;

export async function loadConfigOverride(cwd: string): Promise<AnyOverride> {
	for (const configFile of [
		LOCAL_CONFIG_FILE,
		DEFAULT_CONFIG_FILE,
		LEGACY_CONFIG_FILE,
	]) {
		const configPath = path.join(cwd, configFile);
		try {
			await access(configPath);
		} catch {
			continue;
		}
		const imported = await import(pathToFileURL(configPath).href);
		const override = imported.default ?? imported.config ?? {};
		return override as AnyOverride;
	}
	return {};
}

export function normalizeOverrideToRoot(
	override: AnyOverride,
): AdhdAiRootConfig {
	if ("projects" in override && Array.isArray(override.projects)) {
		return override as AdhdAiRootConfig;
	}
	const legacy = override as DeepPartial<ProjectRuntimeConfig>;
	return {
		...legacy,
		projects: [{ id: "default" }],
	};
}

export function assertNoProjectPolling(projects: ProjectConfig[]): void {
	for (const project of projects) {
		if ("polling" in (project as unknown as Record<string, unknown>)) {
			throw new Error(
				`Project-level polling config is not supported for project '${project.id}'. Configure polling once at root level.`,
			);
		}
	}
}

export function assertNoProjectNotifications(projects: ProjectConfig[]): void {
	for (const project of projects) {
		if ("notifications" in (project as unknown as Record<string, unknown>)) {
			throw new Error(
				`Project-level notifications config is not supported for project '${project.id}'. Configure notifications once at root level.`,
			);
		}
	}
}
