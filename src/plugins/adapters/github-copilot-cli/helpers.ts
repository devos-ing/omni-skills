import type { CliProcessRunner, CliRunResult, CliStreamEvent, CliStreamRunner } from "../types";
import { buildGithubCopilotGoalCommand } from "./commands";

export async function runGithubCopilotGoal(
  goal: string,
  runner: CliProcessRunner,
): Promise<CliRunResult> {
  return runner(buildGithubCopilotGoalCommand(goal));
}

export async function* streamGithubCopilotGoal(
  goal: string,
  runner: CliStreamRunner,
): AsyncIterable<CliStreamEvent> {
  yield* runner(buildGithubCopilotGoalCommand(goal));
}
