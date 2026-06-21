import type {
  CliInvocation,
  CliProcessRunner,
  CliRunResult,
  CliStreamEvent,
  CliStreamRunner,
  WorkerCliAdapter,
  WorkerCliAdapterConfig,
} from "./types";

export function createWorkerCliAdapter(config: WorkerCliAdapterConfig): WorkerCliAdapter {
  const baseArgs = config.baseArgs ?? [];

  return {
    id: config.id,
    displayName: config.displayName,
    kind: "worker_adapter",
    description: config.description,
    executable: config.executable,
    baseArgs,
    goalInput: config.goalInput,
    buildGoalInvocation(goal: string): CliInvocation {
      const normalizedGoal = normalizeGoal(goal);

      if (config.goalInput.mode === "stdin") {
        return {
          executable: config.executable,
          args: baseArgs,
          stdin: `${config.goalInput.command} ${JSON.stringify(normalizedGoal)}`,
        };
      }

      return {
        executable: config.executable,
        args: [...baseArgs, `${config.goalInput.prefix}${normalizedGoal}`],
      };
    },
    async runGoal(goal: string, runner: CliProcessRunner): Promise<CliRunResult> {
      return runner(this.buildGoalInvocation(goal));
    },
    async *streamGoal(goal: string, runner: CliStreamRunner): AsyncIterable<CliStreamEvent> {
      yield* runner(this.buildGoalInvocation(goal));
    },
  };
}

export function normalizeGoal(goal: string): string {
  const normalized = goal.trim().replace(/\s+/g, " ");

  if (!normalized) {
    throw new Error("Goal cannot be empty");
  }

  return normalized;
}
