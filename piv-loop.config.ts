import path from "node:path";
import type { DeepPartial, PivLoopRootConfig } from "./src/types";

const cwd = process.cwd();

const config: DeepPartial<PivLoopRootConfig> = {
	projects: [
		{
			id: "piv-47ea7f022b5d",
			name: "Default Project",
			workspacePath: process.env.PIV_WORKSPACE_PATH ?? cwd,
			executionPath:
				process.env.PIV_EXECUTION_PATH ?? process.env.PIV_WORKSPACE_PATH ?? cwd,
		},
	],
	repo: {
		owner: process.env.GITHUB_REPO_OWNER ?? "",
		name: process.env.GITHUB_REPO_NAME ?? "",
		baseBranch: process.env.GITHUB_BASE_BRANCH ?? "main",
	},
	linear: {
		statusMap: {
			assigned: process.env.LINEAR_STATUS_ASSIGNED ?? "Todo",
			planning: process.env.LINEAR_STATUS_PLANNING ?? "In Progress",
			implementing: process.env.LINEAR_STATUS_IMPLEMENTING ?? "In Progress",
			pr_created: process.env.LINEAR_STATUS_PR_CREATED ?? "In Review",
			reviewing: process.env.LINEAR_STATUS_REVIEWING ?? "In Review",
			testing: process.env.LINEAR_STATUS_TESTING ?? "In Review",
			blocked: process.env.LINEAR_STATUS_BLOCKED ?? "Canceled",
			done: process.env.LINEAR_STATUS_DONE ?? "Done",
		},
		labelMap: {
			pr_created: process.env.LINEAR_LABEL_PR_CREATED ?? "PR Created",
			reviewing: process.env.LINEAR_LABEL_REVIEWING ?? "Reviewing",
			testing: process.env.LINEAR_LABEL_TESTING ?? "Testing",
		},
		autoCreateLabels: process.env.LINEAR_AUTO_CREATE_LABELS !== "0",
	},
	skills: {
		plan: path.join(cwd, "skills", "piv-plan", "SKILL.md"),
		implement: path.join(cwd, "skills", "piv-implement", "SKILL.md"),
		reviewTest: path.join(cwd, "skills", "piv-review-test", "SKILL.md"),
	},
};

export default config;
