import { describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  createDefaultSetupReviewBots,
  createSetupManifest,
} from "../src/runtimes/ponytrail/manifest";
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
      expect(readme).toContain("Runtime Court");
      expect(readme).toContain('ponyrace ponyrace "<request>"');
      expect(readme).toContain("configured review ponies");
      expect(readme).toContain("manifest approval rule");
      expect(readme).toContain("/amend-goal");
      expect(readme).toContain(".ponytrail/goals");
      expect(readme).not.toContain("2 of 3");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("writes a provided setup manifest", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-onboarding-"));
    const manifest = createSetupManifest({
      name: "Injected Setup",
      reviewBots: createDefaultSetupReviewBots().slice(0, 3),
    });

    try {
      await createOnboardingFiles({
        rootDir,
        projectName: "Injected Setup",
        manifest,
      });

      const manifestFile = await readFile(join(rootDir, ".ponytrail", "manifest.json"), "utf8");
      const writtenManifest = JSON.parse(manifestFile);
      expect(writtenManifest.metadata.name).toBe("Injected Setup");
      expect(writtenManifest.deliberation.decisionRule.voters).toBe(3);
      expect(writtenManifest.deliberation.decisionRule.requiredApprovals).toBe(2);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});
