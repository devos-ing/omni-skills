import type { CliProcessRunner, CliRunResult, CliStreamEvent, CliStreamRunner } from "../types";
import { buildCodexGoalCommand } from "./commands";

export async function runCodexGoal(goal: string, runner: CliProcessRunner): Promise<CliRunResult> {
  return runner(buildCodexGoalCommand(goal));
}

export async function* streamCodexGoal(
  goal: string,
  runner: CliStreamRunner,
): AsyncIterable<CliStreamEvent> {
  yield* runner(buildCodexGoalCommand(goal));
}
