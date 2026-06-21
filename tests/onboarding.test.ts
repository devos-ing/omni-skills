import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOnboardingFiles } from "../src/runtimes/ponytrail/onboarding";

describe("onboarding", () => {
  test("creates manifest, runtime directories, and local README", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-onboarding-"));

    try {
      const result = await createOnboardingFiles({
        rootDir,
        projectName: "Runtime Court",
      });

      expect(result.created).toContain(join(rootDir, ".ponytrail", "manifest.json"));
      expect(result.created).toContain(join(rootDir, ".ponytrail", "README.md"));
      await expect(stat(join(rootDir, ".ponytrail", "goals"))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, ".ponytrail", "plugins"))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, ".ponytrail", "skills"))).resolves.toBeTruthy();
      await expect(stat(join(rootDir, ".ponytrail", "runtimes"))).resolves.toBeTruthy();

      const readme = await readFile(join(rootDir, ".ponytrail", "README.md"), "utf8");
      expect(readme).toContain("/goal");
      expect(readme).toContain("Runtime Court");
      expect(readme).toContain(".ponytrail/goals");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
