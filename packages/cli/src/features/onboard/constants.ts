import type { CodexReasoningEffort } from "../types";
import type { OnboardDraft } from "./types/onboard.types";
export { INSTANCE_CONFIG_FILE } from "../config/home-paths";

export const ENV_FILE = ".env";
export const DEFAULT_WORKSPACE_NAME = "Default Workspace";
export const DEFAULT_PROJECT_NAME = "Default Project";
export const LOCAL_WORKSPACE_ID = "owner-1";
export const LOCAL_BOARD_ID = "board-1";
export const DEFAULT_BASE_BRANCH = "main";
export const RTK_INSTALL_URL = "https://github.com/rtk-ai/rtk";
export const GITHUB_CLI_INSTALL_URL =
	"https://cli.github.com/manual/installation";

export const DEFAULT_STATUS_MAP: OnboardDraft["statusMap"] = {
	backlog: "Backlog",
	assigned: "Todo",
	plan: "In Progress",
	in_progress: "In Progress",
	in_review: "In Review",
	canceled: "Canceled",
	failed: "Failed",
	done: "Done",
};

export const DEFAULT_LABEL_MAP: OnboardDraft["labelMap"] = {
	pr_created: "PR Created",
	reviewing: "Reviewing",
	testing: "Testing",
};

export const DEFAULT_REASONING_EFFORTS = {
	brainstorm: "high",
	plan: "high",
	implement: "medium",
	reviewTest: "medium",
} as const satisfies Record<string, CodexReasoningEffort>;
