import { basename } from "node:path";
import { claudeCliAdapter } from "./claude-cli";
import { codexCliAdapter } from "./codex-cli";
import { githubCopilotCliAdapter } from "./github-copilot-cli";
import type { WorkerCliAdapter } from "./types";

export const cliWorkerAdapters = [
  codexCliAdapter,
  claudeCliAdapter,
  githubCopilotCliAdapter,
] satisfies WorkerCliAdapter[];

export function getCliWorkerAdapter(id: string): WorkerCliAdapter {
  const adapter = cliWorkerAdapters.find((candidate) => candidate.id === id);

  if (!adapter) {
    throw new Error(`Unknown CLI worker adapter ${id}`);
  }

  return adapter;
}

export function getCliWorkerAdapterForCommand(command: string): WorkerCliAdapter {
  const executable = basename(command.trim().split(/\s+/)[0] ?? "");
  const adapter = cliWorkerAdapters.find((candidate) => candidate.executable === executable);

  if (!adapter) {
    throw new Error(`No CLI worker adapter registered for command ${command}`);
  }

  return adapter;
}

export { claudeCliAdapter } from "./claude-cli";
export { codexCliAdapter } from "./codex-cli";
export { createWorkerCliAdapter } from "./factory";
export { githubCopilotCliAdapter } from "./github-copilot-cli";
export { streamCliInvocation } from "./stream-runner";
export type {
  CliInvocation,
  CliProcessRunner,
  CliRunResult,
  CliStreamEvent,
  CliStreamRunner,
  GoalInputStrategy,
  WorkerCliAdapter,
} from "./types";
