import type { WorkerCliAdapterConfig } from "../types";

export const CODEX_CLI_EXECUTABLE = "codex";
export const CODEX_EXEC_BASE_ARGS = ["exec", "--skip-git-repo-check"] as const;
export const CODEX_GOAL_PREFIX = "Goal: ";

export const codexCliConfig = {
  id: "codex-cli",
  displayName: "Codex CLI",
  description: "Runs a non-interactive Codex CLI worker session with a locked Ponytrail contract.",
  executable: CODEX_CLI_EXECUTABLE,
  baseArgs: [...CODEX_EXEC_BASE_ARGS],
  goalInput: {
    mode: "argument",
    prefix: CODEX_GOAL_PREFIX,
  },
} satisfies WorkerCliAdapterConfig;
