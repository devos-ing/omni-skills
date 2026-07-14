import { describe, expect, test } from "bun:test";
import {
  createCodexCliDispatcher,
  type OrchestrationDispatcher,
} from "../src/plugins/orchestration-dispatcher";
import type { SubprocessCommand, SubprocessResult } from "../src/process";
import type { DispatchPlan } from "../src/runtimes/omniskill/orchestration-dispatch";

const readOnlyPlan: DispatchPlan = {
  workflow: "startup-team",
  role: "catalog:cto",
  task: "Review the service boundary.",
  cwd: "/tmp/project",
  homeDir: "/tmp/home",
  profileId: "omniskills-startup-team-cto",
  profilePath: "/tmp/home/.codex/agents/omniskills-startup-team-cto.toml",
  profileHash: `sha256:${"a".repeat(64)}`,
  runtime: "codex",
  tier: "deep",
  model: "gpt-5.6",
  effort: "high",
  access: "read-only",
  instructions: "You are the catalog:cto agent.",
  consultation: "request",
  limits: {
    retryPerCandidate: 1,
    reassignmentPerWorkItem: 1,
    consultationsPerAgent: 2,
  },
  candidateIndex: 0,
  candidateCount: 1,
  evidenceRequired: "launch_configured",
  workspaceWriteApproved: false,
};

function dispatcherWith(result: SubprocessResult): {
  dispatcher: OrchestrationDispatcher;
  commands: SubprocessCommand[];
  events: unknown[];
} {
  const commands: SubprocessCommand[] = [];
  const events: unknown[] = [];
  return {
    commands,
    events,
    dispatcher: createCodexCliDispatcher(
      async (command) => {
        commands.push(command);
        return result;
      },
      (event) => events.push(event),
    ),
  };
}

describe("Codex orchestration dispatcher", () => {
  test("launches with explicit model, effort, sandbox, instructions, and stdin", async () => {
    const { dispatcher, commands } = dispatcherWith({
      exitCode: 0,
      stderr: "",
      stdout: [
        JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n"),
    });

    const result = await dispatcher.dispatch(readOnlyPlan);

    expect(commands).toHaveLength(1);
    expect(commands[0]).toEqual({
      executable: "codex",
      args: [
        "exec",
        "--json",
        "--skip-git-repo-check",
        "-C",
        "/tmp/project",
        "-m",
        "gpt-5.6",
        "-c",
        'model_reasoning_effort="high"',
        "-c",
        'developer_instructions="You are the catalog:cto agent."',
        "-s",
        "read-only",
        "-",
      ],
      cwd: "/tmp/project",
      stdin: "Review the service boundary.",
      onStdoutLine: expect.any(Function),
    });
    expect(result).toEqual({
      status: "completed",
      evidence: "launch_configured",
      sessionId: "thread-1",
    });
  });

  test("reports runtime model evidence and fails closed on mismatch", async () => {
    const matching = dispatcherWith({
      exitCode: 0,
      stderr: "",
      stdout: [
        JSON.stringify({ type: "thread.started", thread_id: "thread-1" }),
        JSON.stringify({ type: "model.selected", model: "gpt-5.6" }),
        JSON.stringify({ type: "turn.completed" }),
      ].join("\n"),
    });
    await expect(matching.dispatcher.dispatch(readOnlyPlan)).resolves.toEqual({
      status: "completed",
      evidence: "runtime_reported",
      sessionId: "thread-1",
      runtimeModel: "gpt-5.6",
    });

    const mismatching = dispatcherWith({
      exitCode: 0,
      stderr: "",
      stdout: JSON.stringify({ type: "model.selected", model: "gpt-5.4" }),
    });
    await expect(mismatching.dispatcher.dispatch(readOnlyPlan)).resolves.toEqual({
      status: "failed",
      evidence: "runtime_reported",
      runtimeModel: "gpt-5.4",
      failureCode: "runtime_mismatch",
      failureReason: "Runtime reported gpt-5.4; dispatch required gpt-5.6",
    });
  });

  test("classifies CLI upgrade and model availability failures", async () => {
    const upgrade = dispatcherWith({
      exitCode: 1,
      stdout: "",
      stderr: "The 'gpt-5.6' model requires a newer version of Codex.",
    });
    expect(await upgrade.dispatcher.dispatch(readOnlyPlan)).toEqual(
      expect.objectContaining({
        status: "failed",
        failureCode: "runtime_upgrade_required",
      }),
    );

    const unavailable = dispatcherWith({
      exitCode: 1,
      stdout: "",
      stderr: "model gpt-5.6 is not available for this account",
    });
    expect(await unavailable.dispatcher.dispatch(readOnlyPlan)).toEqual(
      expect.objectContaining({ status: "failed", failureCode: "model_unavailable" }),
    );
  });

  test("checks availability without starting a task", async () => {
    const commands: SubprocessCommand[] = [];
    const dispatcher = createCodexCliDispatcher(async (command) => {
      commands.push(command);
      return { exitCode: 0, stdout: "codex-cli 1.0.0\n", stderr: "" };
    });

    await expect(dispatcher.available(readOnlyPlan.cwd)).resolves.toBe(true);
    expect(commands).toEqual([{ executable: "codex", args: ["--version"], cwd: readOnlyPlan.cwd }]);
  });
});
