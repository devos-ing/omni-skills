import type {
	PollingConfig,
	ResolvedProjectConfig,
} from "../../features/types";
import type { resolveNotifications } from "./notification-resolution";

export interface LoadedConfig {
	projects: ResolvedProjectConfig[];
	polling: PollingConfig;
	notifications: ReturnType<typeof resolveNotifications>;
}
