import { createWorkerCliAdapter } from "../factory";
import type { CliInvocation } from "../types";
import { claudeCliConfig } from "./utils";

export function buildClaudeGoalCommand(goal: string): CliInvocation {
  return createWorkerCliAdapter(claudeCliConfig).buildGoalInvocation(goal);
}
