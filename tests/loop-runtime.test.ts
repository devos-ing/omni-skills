import { describe, expect, test } from "bun:test";
import { chmod, mkdir, mkdtemp, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  getPreparedWorkflowSkillInstallDependencies,
  loadWorkflowBundle,
} from "../src/runtimes/getsuperpower/workflow-bundles";

const repoRoot = join(import.meta.dir, "..");
const runtimeModule = join(
  repoRoot,
  "src",
  "runtimes",
  "getsuperpower",
  "workflow-loop-runtime.mjs",
);
const workflowJson = join(
  repoRoot,
  "examples",
  "workflows",
  "grilled-product-dev",
  "workflow.json",
);

interface LoopResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runNode(
  args: string[],
  env: Record<string, string | undefined> = {},
): Promise<LoopResult> {
  const subprocess = Bun.spawn(["node", ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      ...env,
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
}

async function runRuntime(
  args: string[],
  homeDir: string,
  workflowJsonInput: string | URL = pathToFileURL(workflowJson),
  extraInput: Record<string, unknown> = {},
): Promise<LoopResult> {
  const stdout: string[] = [];
  const stderr: string[] = [];
  const { runWorkflowLoopCli } = await import(pathToFileURL(runtimeModule).href);

  const exitCode = await runWorkflowLoopCli({
    argv: args,
    workflowJson: workflowJsonInput,
    cwd: repoRoot,
    homeDir,
    ...extraInput,
    stdout: (value: string) => stdout.push(value),
    stderr: (value: string) => stderr.push(value),
  });

  return {
    stdout: stdout.join(""),
    stderr: stderr.join(""),
    exitCode,
  };
}

function parseJsonOutput(result: LoopResult): unknown {
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout);
}

function parseRunIdFromTextOutput(stdout: string): string {
  const firstLine = stdout.split("\n")[0] ?? "";
  const prefix = "grilled-product-dev ";
  expect(firstLine.startsWith(prefix)).toBe(true);
  return firstLine.slice(prefix.length);
}

describe("loop runtime", () => {
  test("generated loop.mjs bridge forwards to the GetSuperpower CLI", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "loop-runtime-generated-"));
    const bundle = await loadWorkflowBundle(
      join(repoRoot, "examples", "workflows", "grilled-product-dev"),
    );
    const prepared = await getPreparedWorkflowSkillInstallDependencies({ bundle, tempDir });

    try {
      const preparedEntry = prepared.dependencies[0]?.source ?? "";
      const generatedRunnerPath = join(preparedEntry, "loop.mjs");
      const generatedRunner = await readFile(generatedRunnerPath, "utf8");
      expect(generatedRunner).toContain("GETSUPERPOWER_BIN");
      expect(generatedRunner).toContain("getsuperpower");
      expect(generatedRunner).toContain("workflow.json");
      expect(generatedRunner).not.toContain("function parseArgs");
      await expect(stat(join(preparedEntry, "loop-runtime.mjs"))).rejects.toThrow();

      const shimDir = join(tempDir, "bin");
      const callsPath = join(tempDir, "cli-call.json");
      const shimPath = join(shimDir, "getsuperpower-shim.mjs");
      await mkdir(shimDir, { recursive: true });
      await writeFile(
        shimPath,
        [
          "#!/usr/bin/env node",
          'import { writeFileSync } from "node:fs";',
          `writeFileSync(${JSON.stringify(callsPath)}, JSON.stringify(process.argv.slice(2)));`,
          "",
        ].join("\n"),
      );
      await chmod(shimPath, 0o755);

      const forwarded = await runNode([generatedRunnerPath, "status", "--latest", "--json"], {
        GETSUPERPOWER_BIN: shimPath,
      });
      expect(forwarded.exitCode).toBe(0);
      expect(forwarded.stderr).toBe("");
      expect(JSON.parse(await readFile(callsPath, "utf8"))).toEqual([
        "loop",
        "status",
        await realpath(join(preparedEntry, "workflow.json")),
        "--latest",
        "--json",
      ]);

      const missingCli = await runNode([generatedRunnerPath, "status", "--latest", "--json"], {
        GETSUPERPOWER_BIN: join(tempDir, "missing-getsuperpower"),
      });
      expect(missingCli.exitCode).toBe(1);
      expect(missingCli.stderr).toContain(
        "GetSuperpower CLI is required to run loop.mjs. Install or expose getsuperpower on PATH.",
      );
    } finally {
      await prepared.cleanup?.();
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  test("runWorkflowLoopCli manages run state through the reusable runtime", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-direct-home-"));

    try {
      const result = await runRuntime(
        ["start", "--run", "direct", "--json"],
        homeDir,
        workflowJson,
      );

      expect(result.exitCode).toBe(0);
      expect(result.stderr).toBe("");
      const payload = JSON.parse(result.stdout);
      expect(payload.runId).toBe("direct");
      expect(payload.goal).toEqual({
        type: "goal_based",
        goal: "Produce an approved implementation plan for a product-development request.",
        done_when: [
          "grilled_direction_approved",
          "design_spec_approved",
          "implementation_plan_written",
        ],
        stop_when: ["human_blocks", "verification_fails", "workflow_complete"],
      });
      expect(payload.step.id).toBe("grill");
      expect(payload.step.verify).toEqual({
        type: "human_approval",
        event: "approval",
        message_includes: "direction ready",
      });
      expect(payload.actions).toContainEqual({
        type: "verify",
        step: "grill",
        verify: {
          type: "human_approval",
          event: "approval",
          message_includes: "direction ready",
        },
        description: "Check the phase verification rule before advancing.",
      });
      await expect(
        stat(
          join(homeDir, ".getsuperpower", "runs", "grilled-product-dev", "direct", "state.json"),
        ),
      ).resolves.toBeTruthy();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("runWorkflowLoopCli can render caller-specific action commands", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-prefix-home-"));
    const workflowSource = "examples/workflows/grilled-product-dev";

    try {
      const payload = parseJsonOutput(
        await runRuntime(["start", "--run", "prefix", "--json"], homeDir, workflowJson, {
          commandPrefix: (command: string) => `getsuperpower loop ${command} ${workflowSource}`,
        }),
      ) as {
        actions: Array<{ type: string; command?: string }>;
      };

      const commands = payload.actions.map((action) => action.command).filter(Boolean);
      expect(commands).toContain(
        `getsuperpower loop log ${workflowSource} --run prefix --type phase_result --message "..."`,
      );
      expect(commands).toContain(`getsuperpower loop advance ${workflowSource} --run prefix`);
      expect(commands.join("\n")).not.toContain("node loop.mjs");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("runWorkflowLoopCli supports text output, forced advance, summaries, and completion", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-direct-home-"));

    try {
      const start = await runRuntime(["start"], homeDir);
      expect(start.exitCode).toBe(0);
      expect(start.stderr).toBe("");
      expect(start.stdout).toContain("Status: active");
      expect(start.stdout).toContain("Step: grill - Sharpen the request through grilling");
      expect(start.stdout).toContain("Skill: mattpocock:grilling");
      const runId = parseRunIdFromTextOutput(start.stdout);

      const status = parseJsonOutput(
        await runRuntime(["status", "--latest", "--json"], homeDir),
      ) as {
        goal: { goal: string };
        selectedByLatest: boolean;
        runId: string;
        step: { id: string; verify: { type: string } };
      };
      expect(status.goal.goal).toBe(
        "Produce an approved implementation plan for a product-development request.",
      );
      expect(status.selectedByLatest).toBe(true);
      expect(status.runId).toBe(runId);
      expect(status.step.id).toBe("grill");
      expect(status.step.verify.type).toBe("human_approval");

      const log = await runRuntime(
        [
          "log",
          "--run",
          runId,
          "--type",
          "phase_result",
          "--step",
          "grill",
          "--message",
          "Drafted the grill result",
          "--metadata",
          '{"result":"ok"}',
        ],
        homeDir,
      );
      expect(log.exitCode).toBe(0);
      expect(log.stderr).toBe("");
      expect(log.stdout).toContain("Status: ok");
      expect(log.stdout).toContain("- advance: Run only after explicit human approval.");

      const forced = parseJsonOutput(
        await runRuntime(
          [
            "advance",
            "--run",
            runId,
            "--to",
            "plan",
            "--force",
            "--reason",
            "Skip shape after approval",
            "--json",
          ],
          homeDir,
        ),
      ) as {
        status: string;
        step: { id: string; index: number };
      };
      expect(forced.status).toBe("active");
      expect(forced.step).toMatchObject({ id: "plan", index: 2 });

      const summary = await runRuntime(["summary", "--latest"], homeDir);
      expect(summary.exitCode).toBe(0);
      expect(summary.stderr).toBe("");
      expect(summary.stdout).toContain("Status: ok");
      expect(summary.stdout).toContain("Summary: ");
      const summaryPath = summary.stdout
        .split("\n")
        .find((line) => line.startsWith("Summary: "))
        ?.slice("Summary: ".length);
      expect(summaryPath).toBeTruthy();
      const summaryMarkdown = await readFile(summaryPath ?? "", "utf8");
      expect(summaryMarkdown).toContain("Current step: plan");
      expect(summaryMarkdown).toContain(
        "Goal: Produce an approved implementation plan for a product-development request.",
      );
      expect(summaryMarkdown).toContain("- done_when: grilled_direction_approved");
      expect(summaryMarkdown).toContain("- stop_when: workflow_complete");
      expect(summaryMarkdown).toContain("- grill: Sharpen the request through grilling");
      expect(summaryMarkdown).toContain("Skip shape after approval");
      expect(summaryMarkdown).toContain("Drafted the grill result");

      const complete = parseJsonOutput(
        await runRuntime(["advance", "--run", runId, "--json"], homeDir),
      ) as {
        status: string;
        step: null;
        instruction: string;
        actions: Array<{ type: string; command: string; description: string }>;
      };
      expect(complete.status).toBe("complete");
      expect(complete.step).toBeNull();
      expect(complete.instruction).toBe("Workflow is complete.");
      expect(complete.actions).toEqual([
        {
          type: "summary",
          command: `node loop.mjs summary --run ${runId}`,
          description: "Generate or refresh the mechanical workflow summary.",
        },
      ]);

      const completedStatus = await runRuntime(["status", "--run", runId], homeDir);
      expect(completedStatus.exitCode).toBe(0);
      expect(completedStatus.stderr).toBe("");
      expect(completedStatus.stdout).toContain("Status: complete");
      expect(completedStatus.stdout).toContain("Instruction: Workflow is complete.");
      expect(completedStatus.stdout).toContain(
        "- summary: Generate or refresh the mechanical workflow summary.",
      );

      const completedSummary = parseJsonOutput(
        await runRuntime(["summary", "--run", runId, "--json"], homeDir),
      ) as {
        summaryPath: string;
      };
      await expect(readFile(completedSummary.summaryPath, "utf8")).resolves.toContain(
        "Current step: complete",
      );

      const runDir = join(homeDir, ".getsuperpower", "runs", "grilled-product-dev", runId);
      const eventTypes = (await readFile(join(runDir, "events.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line).type);
      expect(eventTypes).toEqual([
        "start",
        "status",
        "phase_result",
        "force_advance",
        "summary",
        "complete",
        "status",
        "summary",
      ]);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("runWorkflowLoopCli reports command and option errors", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-direct-errors-home-"));

    try {
      const missingLatest = await runRuntime(["status", "--latest", "--json"], homeDir);
      expect(missingLatest.exitCode).toBe(1);
      expect(missingLatest.stdout).toBe("");
      expect(missingLatest.stderr).toContain(
        "No active runs found for grilled-product-dev. Start one with: node loop.mjs start",
      );

      const unknownCommand = await runRuntime(["pause"], homeDir);
      expect(unknownCommand.exitCode).toBe(1);
      expect(unknownCommand.stderr).toContain(
        "Usage: node loop.mjs <start|status|log|advance|summary> [options]",
      );

      const unexpectedArgument = await runRuntime(["start", "loose"], homeDir);
      expect(unexpectedArgument.exitCode).toBe(1);
      expect(unexpectedArgument.stderr).toContain("Unexpected argument: loose");

      const missingValue = await runRuntime(["start", "--run"], homeDir);
      expect(missingValue.exitCode).toBe(1);
      expect(missingValue.stderr).toContain("Missing value for --run");

      expect(
        parseJsonOutput(
          await runRuntime(
            ["start", "--run", "override", "--workflow-json", workflowJson, "--json"],
            homeDir,
            new URL("file:///tmp/missing-workflow.json"),
          ),
        ),
      ).toMatchObject({ runId: "override", step: { id: "grill" } });

      const duplicateRun = await runRuntime(["start", "--run", "override", "--json"], homeDir);
      expect(duplicateRun.exitCode).toBe(1);
      expect(duplicateRun.stderr).toContain("Run already exists: override");

      const unsupportedEvent = await runRuntime(
        ["log", "--run", "override", "--type", "bogus", "--json"],
        homeDir,
      );
      expect(unsupportedEvent.exitCode).toBe(1);
      expect(unsupportedEvent.stderr).toContain("Unsupported event type: bogus");

      const invalidMetadata = await runRuntime(
        ["log", "--run", "override", "--type", "approval", "--metadata", "{", "--json"],
        homeDir,
      );
      expect(invalidMetadata.exitCode).toBe(1);
      expect(invalidMetadata.stderr).toContain("--metadata must be valid JSON");

      const missingRun = await runRuntime(["log", "--type", "approval"], homeDir);
      expect(missingRun.exitCode).toBe(1);
      expect(missingRun.stderr).toContain("log requires --run <id>");

      const forcedWithoutReason = await runRuntime(
        ["advance", "--run", "override", "--to", "shape", "--force"],
        homeDir,
      );
      expect(forcedWithoutReason.exitCode).toBe(1);
      expect(forcedWithoutReason.stderr).toContain("advance --to requires --force and --reason");

      const unknownTarget = await runRuntime(
        [
          "advance",
          "--run",
          "override",
          "--to",
          "missing",
          "--force",
          "--reason",
          "Try a missing step",
        ],
        homeDir,
      );
      expect(unknownTarget.exitCode).toBe(1);
      expect(unknownTarget.stderr).toContain("Unknown workflow step: missing");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("status fails plainly without a run id or latest selector", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-home-"));

    try {
      const result = await runRuntime(["status", "--json"], homeDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Pass --run <id> or --latest.");
      expect(result.stdout).toBe("");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
