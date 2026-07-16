import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const repoRoot = join(import.meta.dir, "..");

describe("production CLI spawn boundary", () => {
  test("excludes dormant dispatch modules from source entrypoints and the built bundle", async () => {
    const sourceContracts = [
      {
        path: "src/cli.ts",
        forbidden: ["createCodexCliDispatcher", "dispatchers:"],
      },
      {
        path: "src/omniskill.ts",
        forbidden: [
          "OrchestrationDispatcher",
          "createOrchestrationRunStore",
          "_configureDispatchCommand",
          "runOmniskillDispatchResume",
        ],
      },
      {
        path: "src/plugins/index.ts",
        forbidden: ["./orchestration-dispatcher", "./orchestration-run-store"],
      },
      {
        path: "src/runtimes/omniskill/index.ts",
        forbidden: ["./orchestration-dispatch"],
      },
    ];

    for (const contract of sourceContracts) {
      const source = await readFile(join(repoRoot, contract.path), "utf8");
      for (const forbidden of contract.forbidden) {
        expect(source).not.toContain(forbidden);
      }
    }

    const outputDir = await mkdtemp(join(tmpdir(), "omniskill-cli-bundle-"));
    const outputPath = join(outputDir, "cli.js");
    try {
      const build = Bun.spawn(
        ["bun", "build", "--target=node", `--outfile=${outputPath}`, "src/cli.ts"],
        { cwd: repoRoot, stdout: "pipe", stderr: "pipe" },
      );
      const exitCode = await build.exited;
      expect(exitCode).toBe(0);

      const bundle = await readFile(outputPath, "utf8");
      for (const forbidden of [
        "createCodexCliDispatcher",
        "DispatchAdapterSchema",
        "DispatchRuntimeSchema",
        "ConsultationDecisionSchema",
        "Orchestration dispatch",
        "Resume a suspended orchestration consultation.",
      ]) {
        expect(bundle).not.toContain(forbidden);
      }
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });
});
