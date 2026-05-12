import type {
	PollingConfig,
	ResolvedProjectConfig,
} from "../../features/types";
import type { resolveAutomations } from "./cron-resolution";
import type { resolveNotifications } from "./notification-resolution";

export interface LoadedConfig {
	projects: ResolvedProjectConfig[];
	polling: PollingConfig;
	automations: ReturnType<typeof resolveAutomations>;
	cron: ReturnType<typeof resolveAutomations>;
	notifications: ReturnType<typeof resolveNotifications>;
}
