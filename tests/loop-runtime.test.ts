import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");
const loopScript = join(repoRoot, "examples", "workflows", "grilled-product-dev", "loop.mjs");

interface LoopResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

async function runLoop(args: string[], homeDir: string): Promise<LoopResult> {
  const subprocess = Bun.spawn(["node", loopScript, ...args], {
    cwd: repoRoot,
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      HOME: homeDir,
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  return { stdout, stderr, exitCode };
}

function parseJsonOutput(result: LoopResult): unknown {
  expect(result.exitCode).toBe(0);
  expect(result.stderr).toBe("");
  return JSON.parse(result.stdout);
}

describe("loop runtime", () => {
  test("grilled-product-dev loop.mjs manages global run state and structured events", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-home-"));

    try {
      const start = parseJsonOutput(
        await runLoop(["start", "--run", "smoke", "--json"], homeDir),
      ) as {
        runId: string;
        step: { id: string; instruction: string };
        actions: Array<{ type: string }>;
      };
      expect(start.runId).toBe("smoke");
      expect(start.step.id).toBe("grill");
      expect(start.step.instruction).toBe(
        "Ask one grilling question, include your recommended answer, and wait for explicit human approval before advancing.",
      );
      expect(start.actions.map((action) => action.type)).toEqual([
        "run_phase",
        "log_event",
        "advance",
      ]);

      const runDir = join(homeDir, ".getsuperpower", "runs", "grilled-product-dev", "smoke");
      await expect(stat(join(runDir, "state.json"))).resolves.toBeTruthy();
      await expect(stat(join(runDir, "events.jsonl"))).resolves.toBeTruthy();

      const status = parseJsonOutput(
        await runLoop(["status", "--latest", "--json"], homeDir),
      ) as {
        selectedByLatest: boolean;
        runId: string;
        step: { id: string };
      };
      expect(status.selectedByLatest).toBe(true);
      expect(status.runId).toBe("smoke");
      expect(status.step.id).toBe("grill");

      const log = parseJsonOutput(
        await runLoop(
          [
            "log",
            "--run",
            "smoke",
            "--type",
            "approval",
            "--message",
            "User approved the grilled direction",
            "--metadata",
            '{"approvedBy":"human"}',
            "--json",
          ],
          homeDir,
        ),
      ) as {
        event: { type: string; step: string; metadata: { approvedBy: string } };
      };
      expect(log.event).toEqual({
        type: "approval",
        step: "grill",
        message: "User approved the grilled direction",
        metadata: { approvedBy: "human" },
      });

      const advance = parseJsonOutput(
        await runLoop(["advance", "--run", "smoke", "--json"], homeDir),
      ) as {
        step: { id: string; instruction: string };
      };
      expect(advance.step.id).toBe("shape");
      expect(advance.step.instruction).toBe(
        "Turn the approved direction into a Superpowers design spec, then wait for explicit human approval before advancing.",
      );

      const summary = parseJsonOutput(
        await runLoop(["summary", "--run", "smoke", "--json"], homeDir),
      ) as {
        summaryPath: string;
      };
      expect(summary.summaryPath).toBe(join(runDir, "summary.md"));
      await expect(readFile(summary.summaryPath, "utf8")).resolves.toContain(
        "Current step: shape",
      );

      const state = JSON.parse(await readFile(join(runDir, "state.json"), "utf8"));
      expect(state).toMatchObject({
        workflow: "grilled-product-dev",
        runId: "smoke",
        status: "active",
        currentStep: "shape",
        currentStepIndex: 1,
      });

      const eventTypes = (await readFile(join(runDir, "events.jsonl"), "utf8"))
        .trim()
        .split("\n")
        .map((line) => JSON.parse(line).type);
      expect(eventTypes).toEqual(["start", "status", "approval", "advance", "summary"]);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("status fails plainly without a run id or latest selector", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "loop-runtime-home-"));

    try {
      const result = await runLoop(["status", "--json"], homeDir);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain("Pass --run <id> or --latest.");
      expect(result.stdout).toBe("");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
