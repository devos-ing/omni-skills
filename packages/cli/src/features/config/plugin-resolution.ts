import { readFile } from "node:fs/promises";
import type { ResolvedProjectConfig } from "../../features/types";
import { instanceConfigPath } from "./home-paths";

interface InstancePluginRecord {
	enabled?: boolean;
	credentials?: Record<string, string>;
	skills?: Array<{ path?: string }>;
	mcpServers?: Array<{
		name?: string;
		command?: string;
		args?: string[];
		env?: Record<string, string>;
	}>;
}

interface InstancePluginRuntime {
	skillPaths: string[];
	mcpServers: NonNullable<ResolvedProjectConfig["codex"]["mcpServers"]>;
}

export async function applyInstancePlugins(
	projects: ResolvedProjectConfig[],
	readText: (
		targetPath: string,
		encoding: BufferEncoding,
	) => Promise<string> = readFile,
): Promise<ResolvedProjectConfig[]> {
	const runtime = await loadEnabledInstancePluginRuntime(readText);
	if (runtime.skillPaths.length === 0 && runtime.mcpServers.length === 0) {
		return projects;
	}
	return projects.map((project) => ({
		...project,
		codex: {
			...project.codex,
			mcpServers: [...(project.codex.mcpServers ?? []), ...runtime.mcpServers],
		},
		skills: {
			...project.skills,
			pluginSkillPaths: [
				...(project.skills.pluginSkillPaths ?? []),
				...runtime.skillPaths,
			],
		},
	}));
}

async function loadEnabledInstancePluginRuntime(
	readText: (targetPath: string, encoding: BufferEncoding) => Promise<string>,
): Promise<InstancePluginRuntime> {
	let parsed: unknown;
	try {
		parsed = JSON.parse(await readText(instanceConfigPath(), "utf8"));
	} catch {
		return { skillPaths: [], mcpServers: [] };
	}
	if (!isRecord(parsed) || !isRecord(parsed.plugins)) {
		return { skillPaths: [], mcpServers: [] };
	}
	const installed = parsed.plugins.installed;
	if (!Array.isArray(installed)) {
		return { skillPaths: [], mcpServers: [] };
	}
	const skillPaths: string[] = [];
	const mcpServers: InstancePluginRuntime["mcpServers"] = [];
	for (const plugin of installed) {
		if (!isRuntimePlugin(plugin) || !plugin.enabled) continue;
		for (const skill of plugin.skills ?? []) {
			if (typeof skill.path === "string" && skill.path.trim()) {
				skillPaths.push(skill.path);
			}
		}
		for (const server of plugin.mcpServers ?? []) {
			if (isMcpServer(server)) {
				mcpServers.push({
					name: server.name,
					command: server.command,
					args: server.args,
					env: resolveMcpEnv(server.env, plugin.credentials ?? {}),
				});
			}
		}
	}
	return { skillPaths: unique(skillPaths), mcpServers };
}

function resolveMcpEnv(
	env: Record<string, string> | undefined,
	credentials: Record<string, string>,
): Record<string, string> | undefined {
	if (!env) return undefined;
	return Object.fromEntries(
		Object.entries(env).map(([key, value]) => [
			key,
			value.replace(
				/\$\{([A-Z0-9_]+)\}/g,
				(_match, name) => credentials[name] ?? "",
			),
		]),
	);
}

function isRuntimePlugin(value: unknown): value is InstancePluginRecord {
	return typeof value === "object" && value !== null;
}

function isMcpServer(value: unknown): value is {
	name: string;
	command: string;
	args: string[];
	env?: Record<string, string>;
} {
	return (
		isRecord(value) &&
		typeof value.name === "string" &&
		typeof value.command === "string" &&
		Array.isArray(value.args) &&
		value.args.every((arg: unknown) => typeof arg === "string")
	);
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function unique(values: string[]): string[] {
	return Array.from(new Set(values));
}
