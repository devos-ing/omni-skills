import type { RuntimePlugin } from "../types";

export interface CliInvocation {
  executable: string;
  args: string[];
  stdin?: string;
}

export interface CliRunResult {
  invocation: CliInvocation;
  exitCode: number;
  stdout: string;
  stderr: string;
}

export type CliProcessRunner = (invocation: CliInvocation) => Promise<CliRunResult>;

export type CliStreamEvent =
  | {
      type: "start";
      invocation: CliInvocation;
    }
  | {
      type: "stdout";
      chunk: string;
    }
  | {
      type: "stderr";
      chunk: string;
    }
  | {
      type: "exit";
      exitCode: number;
    };

export type CliStreamRunner = (invocation: CliInvocation) => AsyncIterable<CliStreamEvent>;

export interface WorkerCliAdapter extends RuntimePlugin {
  kind: "worker_adapter";
  executable: string;
  baseArgs: string[];
  goalInput: GoalInputStrategy;
  buildGoalInvocation(goal: string): CliInvocation;
  runGoal(goal: string, runner: CliProcessRunner): Promise<CliRunResult>;
  streamGoal(goal: string, runner: CliStreamRunner): AsyncIterable<CliStreamEvent>;
}

export type GoalInputStrategy =
  | {
      mode: "stdin";
      command: string;
    }
  | {
      mode: "argument";
      prefix: string;
    };

export interface WorkerCliAdapterConfig {
  id: string;
  displayName: string;
  description: string;
  executable: string;
  baseArgs?: string[];
  goalInput: GoalInputStrategy;
}
