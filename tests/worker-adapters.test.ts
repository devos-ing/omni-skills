import { describe, expect, test } from "bun:test";
import { createCliRequirementPonyRunner, createLocalRequirementPonyRunner } from "../src/plugins";
import {
  cliWorkerAdapters,
  getCliWorkerAdapter,
  getCliWorkerAdapterForCommand,
} from "../src/plugins/adapters";
import {
  buildClaudeGoalCommand,
  runClaudeGoal,
  streamClaudeGoal,
} from "../src/plugins/adapters/claude-cli";
import {
  buildCodexGoalCommand,
  runCodexGoal,
  streamCodexGoal,
} from "../src/plugins/adapters/codex-cli";
import {
  buildGithubCopilotGoalCommand,
  runGithubCopilotGoal,
  streamGithubCopilotGoal,
} from "../src/plugins/adapters/github-copilot-cli";
import type {
  CliInvocation,
  CliProcessRunner,
  CliStreamEvent,
  CliStreamRunner,
} from "../src/plugins/adapters/types";
import { draftGoalContract } from "../src/runtimes/ponytrail/goal";
import { createDefaultManifest } from "../src/runtimes/ponytrail/manifest";

describe("worker CLI adapters", () => {
  test("registers Codex, Claude, and GitHub Copilot CLI adapters", () => {
    expect(cliWorkerAdapters.map((adapter) => adapter.id)).toEqual([
      "codex-cli",
      "claude-cli",
      "github-copilot-cli",
    ]);
  });

  test("builds goal invocations for conversational CLIs", () => {
    expect(buildCodexGoalCommand("Add CSV import")).toEqual({
      executable: "codex",
      args: ["exec", "--skip-git-repo-check", "Goal: Add CSV import"],
    });

    expect(buildClaudeGoalCommand("Add CSV import")).toEqual({
      executable: "claude",
      args: [],
      stdin: '/goal "Add CSV import"',
    });
  });

  test("builds a prompt argument invocation for GitHub Copilot CLI", () => {
    expect(buildGithubCopilotGoalCommand("Add CSV import")).toEqual({
      executable: "gh",
      args: ["copilot", "suggest", "Goal: Add CSV import"],
    });
  });

  test("runs adapter commands through an injected process runner", async () => {
    const calls: CliInvocation[] = [];
    const runner: CliProcessRunner = async (invocation) => {
      calls.push(invocation);
      return {
        invocation,
        exitCode: 0,
        stdout: "accepted",
        stderr: "",
      };
    };

    await runCodexGoal("Add CSV import", runner);
    await runClaudeGoal("Review tests", runner);
    await runGithubCopilotGoal("Suggest implementation", runner);

    expect(calls).toEqual([
      {
        executable: "codex",
        args: ["exec", "--skip-git-repo-check", "Goal: Add CSV import"],
      },
      {
        executable: "claude",
        args: [],
        stdin: '/goal "Review tests"',
      },
      {
        executable: "gh",
        args: ["copilot", "suggest", "Goal: Suggest implementation"],
      },
    ]);
  });

  test("registry adapters can run goals through the same runner seam", async () => {
    const runner: CliProcessRunner = async (invocation) => ({
      invocation,
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    });

    const result = await getCliWorkerAdapter("codex-cli").runGoal("Add CSV import", runner);

    expect(result).toEqual({
      invocation: {
        executable: "codex",
        args: ["exec", "--skip-git-repo-check", "Goal: Add CSV import"],
      },
      exitCode: 0,
      stdout: "ok",
      stderr: "",
    });
  });

  test("resolves registry adapters from manifest worker commands", () => {
    expect(getCliWorkerAdapterForCommand("codex").id).toBe("codex-cli");
    expect(getCliWorkerAdapterForCommand("claude").id).toBe("claude-cli");
    expect(getCliWorkerAdapterForCommand("gh copilot suggest").id).toBe("github-copilot-cli");
  });

  test("registry adapters can stream goals through an injected stream runner", async () => {
    const streamRunner: CliStreamRunner = async function* (invocation) {
      yield { type: "start", invocation };
      yield { type: "stdout", chunk: "working" };
      yield { type: "stderr", chunk: "warning" };
      yield { type: "exit", exitCode: 0 };
    };

    const events: CliStreamEvent[] = [];
    for await (const event of getCliWorkerAdapter("claude-cli").streamGoal(
      "Review CSV import",
      streamRunner,
    )) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "start",
        invocation: {
          executable: "claude",
          args: [],
          stdin: '/goal "Review CSV import"',
        },
      },
      { type: "stdout", chunk: "working" },
      { type: "stderr", chunk: "warning" },
      { type: "exit", exitCode: 0 },
    ]);
  });

  test("adapter helpers can stream goals through the same stream runner", async () => {
    const streamRunner: CliStreamRunner = async function* (invocation) {
      yield { type: "start", invocation };
      yield { type: "exit", exitCode: 0 };
    };

    const events: CliStreamEvent[] = [];
    for await (const event of streamCodexGoal("Add CSV import", streamRunner)) {
      events.push(event);
    }
    for await (const event of streamClaudeGoal("Review CSV import", streamRunner)) {
      events.push(event);
    }
    for await (const event of streamGithubCopilotGoal("Suggest CSV import", streamRunner)) {
      events.push(event);
    }

    expect(events).toEqual([
      {
        type: "start",
        invocation: {
          executable: "codex",
          args: ["exec", "--skip-git-repo-check", "Goal: Add CSV import"],
        },
      },
      { type: "exit", exitCode: 0 },
      {
        type: "start",
        invocation: {
          executable: "claude",
          args: [],
          stdin: '/goal "Review CSV import"',
        },
      },
      { type: "exit", exitCode: 0 },
      {
        type: "start",
        invocation: {
          executable: "gh",
          args: ["copilot", "suggest", "Goal: Suggest CSV import"],
        },
      },
      { type: "exit", exitCode: 0 },
    ]);
  });

  test("creates a streaming CLI-backed pony runner that prompts one sub-agent and parses its vote", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });
    const bot = manifest.bots.find((candidate) => candidate.id === "engineer_bot");
    const model = manifest.models.find((candidate) => candidate.id === bot?.model);
    const invocations: CliInvocation[] = [];
    const streamRunner: CliStreamRunner = async function* (invocation) {
      invocations.push(invocation);

      yield { type: "start", invocation };
      yield {
        type: "stdout",
        chunk: JSON.stringify({
          message: "Engineering approves with a smoke test.",
          visibleThinking: {
            focus: "Check implementation and verification shape.",
            concern: "The plan needs a smoke test before approval.",
            recommendation: "Approve with a focused CLI smoke check.",
          },
          evidence: ["The engineer skill requires feasibility and verification evidence."],
          vote: "approve",
          confidence: 0.92,
          requiredChanges: [],
        }),
      };
      yield { type: "exit", exitCode: 0 };
    };

    if (!bot || !model) {
      throw new Error("Default manifest is missing the engineer bot or model.");
    }

    const ponyRunner = createCliRequirementPonyRunner({
      adapter: getCliWorkerAdapter("codex-cli"),
      streamRunner,
      writeStdout() {},
      writeStderr() {},
    });

    const response = await ponyRunner({
      manifest,
      bot,
      model,
      contract,
      round: 1,
      priorDiscussion: [],
    });

    expect(response).toEqual({
      message: "Engineering approves with a smoke test.",
      visibleThinking: {
        focus: "Check implementation and verification shape.",
        concern: "The plan needs a smoke test before approval.",
        recommendation: "Approve with a focused CLI smoke check.",
      },
      evidence: ["The engineer skill requires feasibility and verification evidence."],
      vote: "approve",
      confidence: 0.92,
      requiredChanges: [],
    });
    expect(invocations).toHaveLength(1);
    expect(invocations[0]?.args.join(" ")).toContain("Requirement pony review");
    expect(invocations[0]?.args.join(" ")).toContain("Pony: Engineer Bot (engineer_bot)");
    expect(invocations[0]?.args.join(" ")).toContain("Pony skills:");
    expect(invocations[0]?.args.join(" ")).toContain(
      "Check whether the goal can be implemented by the chosen worker agent",
    );
    expect(invocations[0]?.args.join(" ")).toContain("Feasibility Review");
    expect(invocations[0]?.args.join(" ")).toContain(
      "Check repo, tool, permission, and time constraints before approval.",
    );
    expect(invocations[0]?.args.join(" ")).toContain(
      "Do not approve without at least one concrete evidence item.",
    );
    expect(invocations[0]?.args.join(" ")).toContain("visibleThinking");
    expect(invocations[0]?.args.join(" ")).toContain('"evidence": string[]');
    expect(invocations[0]?.args.join(" ")).toContain("Return only JSON");
  });

  test("local pony runner builds its response from manifest skill instructions", async () => {
    const manifest = createDefaultManifest();
    const bot = manifest.bots.find((candidate) => candidate.id === "engineer_bot");
    const model = manifest.models.find((candidate) => candidate.id === bot?.model);
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });

    if (!bot || !model) {
      throw new Error("Default manifest is missing the engineer bot or model.");
    }

    manifest.skills.feasibility_review = {
      ...manifest.skills.feasibility_review,
      displayName: "Custom Feasibility Lens",
      description: "Custom feasibility description.",
      instruction: "Custom skill says inspect cache invalidation before approval.",
    };
    const ponyRunner = createLocalRequirementPonyRunner();
    const response = await ponyRunner({
      manifest,
      bot,
      model,
      contract,
      round: 1,
      priorDiscussion: [],
    });

    expect(response.message).toContain("Custom Feasibility Lens");
    expect(response.message).toContain("Custom skill says inspect cache invalidation");
    expect(response.evidence).toContain(
      "feasibility_review: Custom skill says inspect cache invalidation before approval.",
    );
  });

  test("streams CLI-backed pony stdout and stderr chunks while collecting the JSON vote", async () => {
    const manifest = createDefaultManifest();
    const contract = draftGoalContract("Add CSV import to admin dashboard", { manifest });
    const bot = manifest.bots.find((candidate) => candidate.id === "testing_bot");
    const model = manifest.models.find((candidate) => candidate.id === bot?.model);
    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];
    const order: string[] = [];
    const streamRunner: CliStreamRunner = async function* (invocation) {
      yield { type: "start", invocation };
      yield { type: "stdout", chunk: "sub-agent working\n" };
      order.push("stream resumed after stdout");
      yield { type: "stderr", chunk: "sub-agent warning\n" };
      yield {
        type: "stdout",
        chunk: JSON.stringify({
          message: "Testing approves the smoke evidence.",
          visibleThinking: {
            focus: "Check observable verification.",
            concern: "The smoke path must prove the request.",
            recommendation: "Approve with explicit evidence.",
          },
          evidence: ["The testing skill requires observable acceptance evidence."],
          vote: "approve",
          confidence: 0.86,
          requiredChanges: [],
        }),
      };
      yield { type: "exit", exitCode: 0 };
    };

    if (!bot || !model) {
      throw new Error("Default manifest is missing the testing bot or model.");
    }

    const ponyRunner = createCliRequirementPonyRunner({
      adapter: getCliWorkerAdapter("claude-cli"),
      streamRunner,
      writeStdout(chunk) {
        stdoutChunks.push(chunk);
        order.push(`stdout:${chunk.trim()}`);
      },
      writeStderr(chunk) {
        stderrChunks.push(chunk);
      },
    });

    const response = await ponyRunner({
      manifest,
      bot,
      model,
      contract,
      round: 1,
      priorDiscussion: [],
    });

    expect(order.slice(0, 2)).toEqual(["stdout:sub-agent working", "stream resumed after stdout"]);
    expect(stdoutChunks.join("")).toContain("sub-agent working");
    expect(stderrChunks.join("")).toContain("sub-agent warning");
    expect(response).toMatchObject({
      message: "Testing approves the smoke evidence.",
      evidence: ["The testing skill requires observable acceptance evidence."],
      vote: "approve",
      confidence: 0.86,
    });
  });
});
