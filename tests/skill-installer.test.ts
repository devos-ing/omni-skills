import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installAgentSkill,
  resolveInstallSkillSource,
  type SkillInstallAgent,
} from "../src/plugins/skill-installer";

const allAgents: SkillInstallAgent[] = ["claude", "copilot", "codex", "cursor"];

describe("skill installer", () => {
  test("resolves the bundled pony trail skill by name", async () => {
    const source = await resolveInstallSkillSource("pony-trail");

    expect(source.name).toBe("pony-trail");
    expect(source.kind).toBe("bundled");
    expect(await readFile(join(source.path, "SKILL.md"), "utf8")).toContain("name: pony-trail");
  });

  test("resolves the bundled review past decisions skill by name", async () => {
    const source = await resolveInstallSkillSource("review-past-decisions");

    expect(source.name).toBe("review-past-decisions");
    expect(source.kind).toBe("bundled");
    expect(source.path.endsWith(join("bundled-skills", "review-past-decisions"))).toBe(true);
    expect(await readFile(join(source.path, "SKILL.md"), "utf8")).toContain(
      "name: review-past-decisions",
    );
  });

  test("installs the bundled review past decisions skill into directory and Cursor targets", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        source: "review-past-decisions",
        homeDir,
        agents: ["codex", "cursor"],
      });

      expect(result.skillName).toBe("review-past-decisions");
      expect(result.targets.map((target) => target.status)).toEqual(["installed", "installed"]);

      await expect(
        stat(join(homeDir, ".agents", "skills", "review-past-decisions", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".codex", "skills", "review-past-decisions", "SKILL.md")),
      ).resolves.toBeTruthy();

      const cursorRulePath = join(homeDir, ".cursor", "rules", "review-past-decisions.mdc");
      await expect(stat(cursorRulePath)).resolves.toBeTruthy();
      expect(await readFile(cursorRulePath, "utf8")).toContain("name: review-past-decisions");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("keeps previous bundled skill names as aliases", async () => {
    for (const alias of [
      "record-change-evidence",
      "enter-into-evidence",
      "snapshotting-file-changes",
    ]) {
      const source = await resolveInstallSkillSource(alias);

      expect(source.name).toBe("pony-trail");
      expect(source.kind).toBe("bundled");
      expect(source.path.endsWith(join("bundled-skills", "pony-trail"))).toBe(true);
    }
  });

  test("installs a bundled skill into Claude, Copilot/shared, Codex, and Cursor targets", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: allAgents,
      });

      expect(result.skillName).toBe("pony-trail");
      expect(result.targets.map((target) => target.status)).toEqual([
        "installed",
        "installed",
        "installed",
        "installed",
      ]);

      await expect(
        stat(join(homeDir, ".claude", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".codex", "skills", "pony-trail", "SKILL.md")),
      ).resolves.toBeTruthy();
      const cursorRulePath = join(homeDir, ".cursor", "rules", "pony-trail.mdc");
      await expect(stat(cursorRulePath)).resolves.toBeTruthy();
      expect(await readFile(cursorRulePath, "utf8")).toContain("name: pony-trail");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("updates existing bundled skill targets when requested", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const installedSkillPath = join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md");
    const legacyInstalledSkillPath = join(homeDir, ".codex", "skills", "pony-trail", "SKILL.md");

    try {
      await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["codex"],
      });
      await writeFile(installedSkillPath, "stale skill");
      await writeFile(legacyInstalledSkillPath, "stale legacy skill");

      const dryRun = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["codex"],
        dryRun: true,
        operation: "update",
      });

      expect(dryRun.targets[0]).toMatchObject({
        agent: "codex",
        status: "would_update",
      });
      expect(await readFile(installedSkillPath, "utf8")).toBe("stale skill");

      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["codex"],
        operation: "update",
      });

      expect(result.targets[0]).toMatchObject({
        agent: "codex",
        status: "updated",
      });
      expect(await readFile(installedSkillPath, "utf8")).toContain("name: pony-trail");
      expect(await readFile(legacyInstalledSkillPath, "utf8")).toContain("name: pony-trail");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("keeps matching bundled skill targets when update is requested", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["codex"],
      });

      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["codex"],
        operation: "update",
      });

      expect(result.targets[0]).toMatchObject({
        agent: "codex",
        status: "already_present",
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("dry-runs Cursor rule installation", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["cursor"],
        dryRun: true,
      });

      expect(result.targets[0]).toMatchObject({
        agent: "cursor",
        destination: join(homeDir, ".cursor", "rules", "pony-trail.mdc"),
        status: "would_install",
      });
      await expect(stat(join(homeDir, ".cursor", "rules", "pony-trail.mdc"))).rejects.toThrow();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("installs prehook scripts and merges hook settings when requested", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const claudeSettingsPath = join(homeDir, ".claude", "settings.json");

    try {
      await mkdir(join(homeDir, ".claude"), { recursive: true });
      await writeFile(
        claudeSettingsPath,
        JSON.stringify(
          {
            env: { EXISTING: "1" },
            hooks: {
              PreToolUse: [
                {
                  matcher: "Bash",
                  hooks: [{ type: "command", command: "existing-hook" }],
                },
              ],
            },
          },
          null,
          2,
        ),
      );

      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: allAgents,
        force: true,
        installPrehook: true,
      });

      expect(result.prehooks.map((prehook) => prehook.status)).toEqual([
        "installed",
        "installed",
        "installed",
      ]);

      const claudeHookPath = join(homeDir, ".claude", "hooks", "ponytrail-prehook.sh");
      const codexHookPath = join(homeDir, ".codex", "hooks", "ponytrail-prehook.sh");
      const copilotHookPath = join(homeDir, ".agents", "hooks", "ponytrail-prehook.sh");

      await expect(stat(claudeHookPath)).resolves.toBeTruthy();
      await expect(stat(codexHookPath)).resolves.toBeTruthy();
      await expect(stat(copilotHookPath)).resolves.toBeTruthy();
      expect(await readFile(claudeHookPath, "utf8")).toContain("$pony-trail");

      const claudeSettings = JSON.parse(await readFile(claudeSettingsPath, "utf8"));
      expect(claudeSettings.env.EXISTING).toBe("1");
      expect(
        claudeSettings.hooks.PreToolUse.some(
          (entry: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
            entry.matcher === "Bash" &&
            entry.hooks?.some((hook) => hook.command === "existing-hook"),
        ),
      ).toBe(true);
      expect(
        claudeSettings.hooks.PreToolUse.some(
          (entry: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
            entry.matcher === "Write" &&
            entry.hooks?.some((hook) => hook.command?.includes(claudeHookPath)),
        ),
      ).toBe(true);

      const codexHooks = JSON.parse(await readFile(join(homeDir, ".codex", "hooks.json"), "utf8"));
      expect(
        codexHooks.hooks.PreToolUse.some(
          (entry: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
            entry.matcher === "Edit" &&
            entry.hooks?.some((hook) => hook.command?.includes(codexHookPath)),
        ),
      ).toBe(true);

      const copilotHooks = JSON.parse(
        await readFile(join(homeDir, ".agents", "hooks.json"), "utf8"),
      );
      expect(
        copilotHooks.hooks.PreToolUse.some(
          (entry: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
            entry.matcher === "MultiEdit" &&
            entry.hooks?.some((hook) => hook.command?.includes(copilotHookPath)),
        ),
      ).toBe(true);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("dry-runs prehook installation without writing hook files", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["codex"],
        dryRun: true,
        installPrehook: true,
      });

      expect(result.prehooks[0]).toMatchObject({
        agent: "codex",
        status: "would_install",
      });
      await expect(
        stat(join(homeDir, ".codex", "hooks", "ponytrail-prehook.sh")),
      ).rejects.toThrow();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("supports dry-run and overwrite protection for path-based skills", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "skill-installer-source-"));
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(rootDir, "custom-skill");
    const existingSkillDir = join(homeDir, ".agents", "skills", "custom-skill");

    try {
      await mkdir(sourceDir, { recursive: true });
      await writeFile(
        join(sourceDir, "SKILL.md"),
        [
          "---",
          "name: custom-skill",
          "description: Use when testing a path-based skill install.",
          "---",
          "",
          "# Custom Skill",
        ].join("\n"),
      );
      await mkdir(existingSkillDir, { recursive: true });
      await writeFile(join(existingSkillDir, "SKILL.md"), "existing");

      const dryRun = await installAgentSkill({
        source: sourceDir,
        homeDir,
        agents: ["claude"],
        dryRun: true,
      });

      expect(dryRun.targets[0]).toMatchObject({
        agent: "claude",
        status: "would_install",
      });
      await expect(
        stat(join(homeDir, ".claude", "skills", "custom-skill", "SKILL.md")),
      ).rejects.toThrow();

      const skipped = await installAgentSkill({
        source: sourceDir,
        homeDir,
        agents: ["codex"],
      });

      expect(skipped.targets[0]).toMatchObject({
        agent: "codex",
        status: "skipped_exists",
      });
      expect(await readFile(join(existingSkillDir, "SKILL.md"), "utf8")).toBe("existing");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
