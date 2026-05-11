import type { CodexReasoningEffort } from "../../core/types";
import type { SetupDraft } from "./setup.types";

export const ENV_FILE = ".env";
export const LOCAL_CONFIG_FILE = "adhd-ai.local.config.ts";
export const DEFAULT_PROJECT_NAME = "Default Project";
export const DEFAULT_BASE_BRANCH = "main";
export const RTK_INSTALL_URL = "https://github.com/rtk-ai/rtk";
export const GITHUB_CLI_INSTALL_URL =
	"https://cli.github.com/manual/installation";
export const LINEAR_API_KEY_SETTINGS_URL =
	"https://linear.app/settings/account/security";

export const DEFAULT_STATUS_MAP: SetupDraft["statusMap"] = {
	backlog: "Backlog",
	assigned: "Todo",
	planning: "In Progress",
	implementing: "In Progress",
	pr_created: "In Review",
	reviewing: "In Review",
	testing: "In Review",
	blocked: "Canceled",
	done: "Done",
};

export const DEFAULT_LABEL_MAP: SetupDraft["labelMap"] = {
	pr_created: "PR Created",
	reviewing: "Reviewing",
	testing: "Testing",
};

export const DEFAULT_REASONING_EFFORTS = {
	plan: "low",
	implement: "low",
	reviewTest: "medium",
} as const satisfies Record<string, CodexReasoningEffort>;
