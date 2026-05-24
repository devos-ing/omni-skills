import path from "node:path";
import { loadDevosPluginManifest } from "create-devos-plugin";
import type {
	InstalledDevosPlugin,
	OnboardInstanceConfig,
} from "../setup/instance-config.types";
import type { RuntimePluginInstallResult } from "./runtime-plugin.types";

export function resolvePluginPath(input: string, cwd: string): string {
	const expanded = input.startsWith("~")
		? path.join(process.env.HOME ?? "", input.slice(1))
		: input;
	return path.resolve(cwd, expanded);
}

export function looksLikePluginPath(input: string): boolean {
	return (
		path.isAbsolute(input) ||
		input.startsWith(".") ||
		input.startsWith("~") ||
		input.includes("/") ||
		input.includes("\\")
	);
}

export async function installRuntimePlugin(
	config: OnboardInstanceConfig,
	inputPath: string,
	cwd: string,
): Promise<RuntimePluginInstallResult> {
	const sourcePath = resolvePluginPath(inputPath, cwd);
	const manifest = await loadDevosPluginManifest(sourcePath);
	const nextPlugin: InstalledDevosPlugin = {
		id: manifest.id,
		sourcePath,
		enabled: false,
		manifest,
		credentials: {},
		skills: manifest.skills.map((skill) => ({
			name: skill.name,
			path: path.resolve(sourcePath, skill.path),
			description: skill.description,
		})),
		mcpServers: manifest.mcpServers,
	};

	const plugins = ensurePluginsConfig(config);
	const index = plugins.installed.findIndex(
		(plugin) => plugin.id === manifest.id,
	);
	if (index === -1) {
		plugins.installed.push(nextPlugin);
		return { plugin: nextPlugin, created: true };
	}
	const existing = plugins.installed[index];
	const updated = {
		...nextPlugin,
		enabled: existing?.enabled ?? false,
		credentials: existing?.credentials ?? {},
	};
	plugins.installed[index] = updated;
	return { plugin: updated, created: false };
}

export function findRuntimePlugin(
	config: OnboardInstanceConfig,
	pluginId: string,
): InstalledDevosPlugin | undefined {
	return config.plugins?.installed.find((plugin) => plugin.id === pluginId);
}

export function listRuntimePlugins(
	config: OnboardInstanceConfig | undefined,
): InstalledDevosPlugin[] {
	return config?.plugins?.installed ?? [];
}

export function ensurePluginsConfig(
	config: OnboardInstanceConfig,
): NonNullable<OnboardInstanceConfig["plugins"]> {
	if (!config.plugins) {
		config.plugins = { installed: [] };
	}
	return config.plugins;
}
