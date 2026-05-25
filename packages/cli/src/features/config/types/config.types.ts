import type { PollingConfig, ResolvedProjectConfig } from "../../types";
import type { resolveNotifications } from "../notification-resolution";
import type { ServerRuntimeConfig } from "./server.types";

export interface LoadedConfig {
	projects: ResolvedProjectConfig[];
	server: ServerRuntimeConfig;
	polling: PollingConfig;
	notifications: ReturnType<typeof resolveNotifications>;
	workspace: WorkspaceRuntimeConfig;
}

export interface WorkspaceRuntimeConfig {
	id: string;
	name: string;
}
