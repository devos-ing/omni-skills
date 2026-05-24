import type {
	DevosPluginManifest,
	DevosPluginMcpServer,
} from "create-devos-plugin";
import type { InstalledDevosPlugin } from "../setup/instance-config.types";

export interface RuntimePluginInstallResult {
	plugin: InstalledDevosPlugin;
	created: boolean;
}

export interface EnabledPluginRuntimeConfig {
	skillPaths: string[];
	mcpServers: DevosPluginMcpServer[];
}

export type RuntimePluginManifest = DevosPluginManifest;
