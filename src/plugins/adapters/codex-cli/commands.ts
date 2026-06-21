import { createWorkerCliAdapter } from "../factory";
import type { CliInvocation } from "../types";
import { codexCliConfig } from "./utils";

export function buildCodexGoalCommand(goal: string): CliInvocation {
  return createWorkerCliAdapter(codexCliConfig).buildGoalInvocation(goal);
}
