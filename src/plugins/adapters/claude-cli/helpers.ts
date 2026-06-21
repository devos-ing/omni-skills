import type { CliProcessRunner, CliRunResult, CliStreamEvent, CliStreamRunner } from "../types";
import { buildClaudeGoalCommand } from "./commands";

export async function runClaudeGoal(goal: string, runner: CliProcessRunner): Promise<CliRunResult> {
  return runner(buildClaudeGoalCommand(goal));
}

export async function* streamClaudeGoal(
  goal: string,
  runner: CliStreamRunner,
): AsyncIterable<CliStreamEvent> {
  yield* runner(buildClaudeGoalCommand(goal));
}
