import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOnboardingFiles } from "../src/runtimes/goal-court/onboarding";

describe("onboarding", () => {
  test("creates manifest, runtime directories, and local README", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "goal-court-onboarding-"));

    try {
      const result = await createOnboardingFiles({
        rootDir,
        projectName: "Runtime Court",
      });

      expect(result.created).toContain(join(rootDir, ".goal-court", "manifest.json"));
      expect(result.created).toContain(join(rootDir, ".goal-court", "README.md"));
      await expect(stat(join(rootDir, ".goal-court", "goals"))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, ".goal-court", "plugins"))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, ".goal-court", "skills"))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, ".goal-court", "runtimes"))).resolves.toBeTruthy();

      const readme = await readFile(join(rootDir, ".goal-court", "README.md"), "utf8");
      expect(readme).toContain("/goal");
      expect(readme).toContain("Runtime Court");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
