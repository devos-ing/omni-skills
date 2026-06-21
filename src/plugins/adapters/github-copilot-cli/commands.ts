import { createWorkerCliAdapter } from "../factory";
import type { CliInvocation } from "../types";
import { githubCopilotCliConfig } from "./utils";

export function buildGithubCopilotGoalCommand(goal: string): CliInvocation {
  return createWorkerCliAdapter(githubCopilotCliConfig).buildGoalInvocation(goal);
}
