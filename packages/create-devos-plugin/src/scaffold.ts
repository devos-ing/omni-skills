import { access, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseDevosPluginManifest } from "./plugin-manifest";
import type {
	DevosPluginPreset,
	DevosPluginTemplate,
	ScaffoldDevosPluginOptions,
	ScaffoldDevosPluginResult,
} from "./scaffold.types";
import {
	buildManifest,
	renderMcpConfig,
	renderPackageJson,
	renderReadme,
	renderSkill,
	renderWorker,
	renderWorkerTest,
	renderWorkerTypes,
} from "./templates";

const PRESET_TEMPLATES: Record<DevosPluginPreset, DevosPluginTemplate> = {
	codegraph: "mcp",
	slack: "connector",
	telegram: "connector",
};

export async function scaffoldDevosPlugin(
	options: ScaffoldDevosPluginOptions,
): Promise<ScaffoldDevosPluginResult> {
	const pluginId = normalizePluginId(options.name);
	const template =
		options.template ?? presetTemplate(options.preset) ?? "skill";
	const pluginPath = path.join(path.resolve(options.outputDir), pluginId);
	await prepareTarget(pluginPath, options.force === true);
	const displayName =
		options.displayName?.trim() || defaultDisplayName(pluginId);
	const description =
		options.description?.trim() || defaultDescription(displayName, template);
	const input = {
		pluginId,
		displayName,
		description,
		author: options.author?.trim() || "devos plugin author",
		template,
		preset: options.preset,
	};
	const manifest = parseDevosPluginManifest(
		buildManifest(input),
		"generated manifest",
	);
	const files = await writeScaffold(pluginPath, input, manifest);
	return { pluginId, pluginPath, manifest, files };
}

export function normalizePluginId(input: string): string {
	const normalized = input
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.replace(/-{2,}/g, "-");
	if (!normalized || normalized.length > 64) {
		throw new Error("Plugin name must normalize to 1-64 kebab-case characters");
	}
	return normalized;
}

function presetTemplate(
	preset: DevosPluginPreset | undefined,
): DevosPluginTemplate | undefined {
	return preset ? PRESET_TEMPLATES[preset] : undefined;
}

async function prepareTarget(
	pluginPath: string,
	force: boolean,
): Promise<void> {
	try {
		await access(pluginPath);
		if (!force)
			throw new Error(`Plugin directory already exists: ${pluginPath}`);
		await rm(pluginPath, { recursive: true, force: true });
	} catch (error) {
		if (!isNotFoundError(error)) throw error;
	}
	await mkdir(pluginPath, { recursive: true });
}

async function writeScaffold(
	pluginPath: string,
	input: Parameters<typeof buildManifest>[0],
	manifest: ReturnType<typeof buildManifest>,
): Promise<string[]> {
	const files: Array<[string, string]> = [
		["package.json", renderPackageJson(input)],
		["README.md", renderReadme(input)],
		["devos.plugin.json", `${JSON.stringify(manifest, null, "\t")}\n`],
		["src/worker.ts", renderWorker(input)],
		["src/worker.types.ts", renderWorkerTypes()],
		["tests/worker.test.ts", renderWorkerTest(input)],
		[`skills/${input.pluginId}/SKILL.md`, renderSkill(input)],
	];
	if (manifest.mcpServers.length > 0) {
		files.push([".mcp.json", renderMcpConfig(manifest)]);
	}
	for (const [relativePath, content] of files) {
		const target = path.join(pluginPath, relativePath);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, content, "utf8");
	}
	return files.map(([relativePath]) => path.join(pluginPath, relativePath));
}

function defaultDisplayName(pluginId: string): string {
	return pluginId
		.split("-")
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1))
		.join(" ");
}

function defaultDescription(
	displayName: string,
	template: DevosPluginTemplate,
): string {
	if (template === "mcp") return `${displayName} MCP plugin for devos agents.`;
	if (template === "connector")
		return `${displayName} connector plugin for devos.`;
	return `${displayName} skill plugin for devos agents.`;
}

function isNotFoundError(error: unknown): boolean {
	return (
		typeof error === "object" &&
		error !== null &&
		"code" in error &&
		(error as { code?: string }).code === "ENOENT"
	);
}
