import type { WorkerCliAdapterConfig } from "../types";

export const GITHUB_COPILOT_CLI_EXECUTABLE = "gh";
export const GITHUB_COPILOT_BASE_ARGS = ["copilot", "suggest"] as const;
export const GITHUB_COPILOT_GOAL_PREFIX = "Goal: ";

export const githubCopilotCliConfig = {
  id: "github-copilot-cli",
  displayName: "GitHub Copilot CLI",
  description: "Runs a GitHub Copilot CLI suggestion flow from a locked Goal Court contract.",
  executable: GITHUB_COPILOT_CLI_EXECUTABLE,
  baseArgs: [...GITHUB_COPILOT_BASE_ARGS],
  goalInput: {
    mode: "argument",
    prefix: GITHUB_COPILOT_GOAL_PREFIX,
  },
} satisfies WorkerCliAdapterConfig;
