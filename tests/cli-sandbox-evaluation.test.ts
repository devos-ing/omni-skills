import { describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  renderCliSandboxEvaluation,
  runCliSandboxEvaluation,
} from "../src/testing/cli-sandbox-evaluation";

describe("CLI sandbox evaluation", () => {
  test("runs before and after workflow checks in isolated sandboxes", async () => {
    const sandboxRoot = await mkdtemp(join(tmpdir(), "getsuperpower-cli-eval-test-"));

    try {
      const report = await runCliSandboxEvaluation({
        generatedAt: "2026-07-02T00:00:00.000Z",
        sandboxRoot,
      });

      expect(report.sandboxRoot).toBe(sandboxRoot);
      expect(report.workflowSource).toBe("examples/workflows/openspec-superpowers");
      expect(report.runs.map((run) => run.mode)).toEqual(["baseline", "workflow"]);
      expect(report.runs.every((run) => run.projectDir.startsWith(sandboxRoot))).toBe(true);
      expect(report.runs.every((run) => run.homeDir.startsWith(sandboxRoot))).toBe(true);
      expect(report.runs.every((run) => run.criteria.every((criterion) => criterion.passed))).toBe(
        true,
      );

      const performanceMetrics = report.matrices.performance.map((row) => row.metric);
      expect(performanceMetrics).toEqual([
        "Active wall-clock time",
        "CLI commands",
        "Check retries",
      ]);

      const accuracyMetrics = report.matrices.accuracy.map((row) => row.metric);
      expect(accuracyMetrics).toEqual([
        "Acceptance criteria passed",
        "Acceptance pass rate",
        "CLI command failures",
        "External side effects",
      ]);

      expect(report.matrices.tokenSpend).toEqual([
        {
          metric: "Input tokens",
          baseline: "unavailable",
          workflow: "unavailable",
          delta: "unavailable",
        },
        {
          metric: "Output tokens",
          baseline: "unavailable",
          workflow: "unavailable",
          delta: "unavailable",
        },
        {
          metric: "Total tokens",
          baseline: "unavailable",
          workflow: "unavailable",
          delta: "unavailable",
        },
        {
          metric: "Tokens per accepted criterion",
          baseline: "unavailable",
          workflow: "unavailable",
          delta: "unavailable",
        },
      ]);
    } finally {
      await rm(sandboxRoot, { recursive: true, force: true });
    }
  });

  test("renders performance accuracy and token spend matrices", async () => {
    const sandboxRoot = await mkdtemp(join(tmpdir(), "getsuperpower-cli-eval-render-"));

    try {
      const report = await runCliSandboxEvaluation({
        generatedAt: "2026-07-02T00:00:00.000Z",
        sandboxRoot,
      });
      const markdown = renderCliSandboxEvaluation(report);

      expect(markdown).toContain("# GetSuperpower CLI Sandbox Evaluation");
      expect(markdown).toContain("## Performance Matrix");
      expect(markdown).toContain("## Accuracy Matrix");
      expect(markdown).toContain("## Token Spend Matrix");
      expect(markdown).toContain("| Active wall-clock time |");
      expect(markdown).toContain("| Acceptance pass rate |");
      expect(markdown).toContain("| Total tokens | unavailable | unavailable | unavailable |");
      expect(markdown).toContain(
        "Token metrics are unavailable because CLI sandbox runs do not expose provider token metadata.",
      );
    } finally {
      await rm(sandboxRoot, { recursive: true, force: true });
    }
  });
});
