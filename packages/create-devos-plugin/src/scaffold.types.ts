import type { DevosPluginManifest } from "./plugin-manifest.types";

export type DevosPluginTemplate = "skill" | "mcp" | "connector";
export type DevosPluginPreset = "codegraph" | "slack" | "telegram";

export interface ScaffoldDevosPluginOptions {
	name: string;
	outputDir: string;
	template?: DevosPluginTemplate;
	preset?: DevosPluginPreset;
	displayName?: string;
	description?: string;
	author?: string;
	force?: boolean;
}

export interface ScaffoldDevosPluginResult {
	pluginId: string;
	pluginPath: string;
	manifest: DevosPluginManifest;
	files: string[];
}
