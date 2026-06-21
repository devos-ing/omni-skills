import type { WorkerCliAdapterConfig } from "../types";

export const CLAUDE_CLI_EXECUTABLE = "claude";
export const CLAUDE_GOAL_COMMAND = "/goal";

export const claudeCliConfig = {
  id: "claude-cli",
  displayName: "Claude CLI",
  description: "Runs a Claude CLI worker session with a locked Goal Court contract.",
  executable: CLAUDE_CLI_EXECUTABLE,
  goalInput: {
    mode: "stdin",
    command: CLAUDE_GOAL_COMMAND,
  },
} satisfies WorkerCliAdapterConfig;
