import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  installAgentSkill,
  parseSkillInstallAgents,
  resolveInstallSkillSource,
  type SkillInstallAgent,
} from "../src/plugins/skill-installer";

const allAgents: SkillInstallAgent[] = ["claude", "copilot", "codex", "cursor"];

async function writeSuperpowersSkill(
  path: string,
  input: { name: string; description: string },
): Promise<void> {
  await mkdir(path, { recursive: true });
  await writeFile(
    join(path, "SKILL.md"),
    [
      "---",
      `name: ${input.name}`,
      `description: "${input.description}"`,
      "---",
      "",
      `# ${input.name}`,
      "",
      `Fake ${input.name} skill for installer tests.`,
    ].join("\n"),
  );
}

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

  test("resolves the bundled creating bundle skills authoring skill by name", async () => {
    const source = await resolveInstallSkillSource("creating-bundle-skills");

    expect(source.name).toBe("creating-bundle-skills");
    expect(source.kind).toBe("bundled");
    expect(source.path.endsWith(join("bundled-skills", "creating-bundle-skills"))).toBe(true);
    expect(await readFile(join(source.path, "SKILL.md"), "utf8")).toContain(
      "Use this skill to create an Omniskills workflow bundle",
    );
  });

  test("resolves the bundled workflow skill authoring helper by name", async () => {
    const source = await resolveInstallSkillSource("writing-workflow-skills");

    expect(source.name).toBe("writing-workflow-skills");
    expect(source.kind).toBe("bundled");
    expect(source.path.endsWith(join("bundled-skills", "writing-workflow-skills"))).toBe(true);

    const skill = await readFile(join(source.path, "SKILL.md"), "utf8");
    expect(skill).toContain("name: writing-workflow-skills");
    expect(skill).toContain("Use when writing or reviewing Omniskills workflow skill files");
    expect(skill).toContain("Use `creating-bundle-skills` for the whole bundle");
    expect(skill).toContain("superpowers:brainstorming");
    expect(skill).toContain("mattpocock:to-prd");
    expect(skill).toContain("Role Output");
  });

  test("defaults to the creating bundle skills authoring skill", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        homeDir,
        agents: ["codex"],
        dryRun: true,
      });

      expect(result.skillName).toBe("creating-bundle-skills");
      expect(result.targets[0]).toMatchObject({
        agent: "codex",
        status: "would_install",
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("installs the bundled workflow skill authoring helper into Codex targets", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        source: "writing-workflow-skills",
        homeDir,
        agents: ["codex"],
      });

      expect(result.skillName).toBe("writing-workflow-skills");
      expect(result.targets[0]).toMatchObject({
        agent: "codex",
        status: "installed",
      });

      await expect(
        stat(join(homeDir, ".agents", "skills", "writing-workflow-skills", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".codex", "skills", "writing-workflow-skills", "SKILL.md")),
      ).resolves.toBeTruthy();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("parses opencode, opencodex, and GitHub Copilot agent aliases", () => {
    expect(
      parseSkillInstallAgents(
        "Claude,codex,cursor,opencode,opencodex,github-copilot,GitHub Copilot,githubcopilot",
      ),
    ).toEqual(["claude", "codex", "cursor", "opencode", "copilot"]);
  });

  test("rejects unknown agent targets even when mixed with supported aliases", () => {
    expect(() => parseSkillInstallAgents("codex,unknown-agent")).toThrow(
      "Unknown skill install agent: unknown-agent",
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

  test("resolves superpowers brainstorming from the local plugin cache", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(
      homeDir,
      ".codex",
      "plugins",
      "cache",
      "openai-curated",
      "superpowers",
      "fake-plugin",
      "skills",
      "brainstorming",
    );

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "brainstorming",
        description: "You MUST use this before any creative work.",
      });

      const source = await resolveInstallSkillSource("superpowers:brainstorming", { homeDir });

      expect(source).toEqual({
        kind: "path",
        name: "superpowers-brainstorming",
        path: sourceDir,
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("resolves superpowers writing-plans from the local plugin cache", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(
      homeDir,
      ".codex",
      "plugins",
      "cache",
      "openai-curated",
      "superpowers",
      "fake-plugin",
      "skills",
      "writing-plans",
    );

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "writing-plans",
        description: "Use when you have a spec or requirements for a multi-step task.",
      });

      const source = await resolveInstallSkillSource("superpowers:writing-plans", { homeDir });

      expect(source).toEqual({
        kind: "path",
        name: "superpowers-writing-plans",
        path: sourceDir,
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("resolves superpowers verification-before-completion from the local plugin cache", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(
      homeDir,
      ".codex",
      "plugins",
      "cache",
      "openai-curated",
      "superpowers",
      "fake-plugin",
      "skills",
      "verification-before-completion",
    );

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "verification-before-completion",
        description: "Use when about to claim work is complete.",
      });

      const source = await resolveInstallSkillSource("superpowers:verification-before-completion", {
        homeDir,
      });

      expect(source).toEqual({
        kind: "path",
        name: "superpowers-verification-before-completion",
        path: sourceDir,
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("resolves superpowers brainstorming from installed local skill folders", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(homeDir, ".agents", "skills", "brainstorming");

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "brainstorming",
        description: "You MUST use this before any creative work.",
      });

      const source = await resolveInstallSkillSource("superpowers:brainstorming", { homeDir });

      expect(source).toEqual({
        kind: "path",
        name: "superpowers-brainstorming",
        path: sourceDir,
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("explains how to install superpowers brainstorming when the plugin cache is missing", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      await expect(
        resolveInstallSkillSource("superpowers:brainstorming", { homeDir }),
      ).rejects.toThrow(
        "Superpowers brainstorming skill not found. Install or enable the Superpowers plugin, then run: omniskill skills install superpowers:brainstorming --agents codex,claude,cursor,copilot,opencode --home ~",
      );
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("explains how to install superpowers writing-plans when the plugin cache is missing", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      await expect(
        resolveInstallSkillSource("superpowers:writing-plans", { homeDir }),
      ).rejects.toThrow(
        "Superpowers writing-plans skill not found. Install or enable the Superpowers plugin, then run: omniskill skills install superpowers:writing-plans --agents codex,claude,cursor,copilot,opencode --home ~",
      );
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("resolves mattpocock skills from installed local skill folders", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(homeDir, ".agents", "skills", "tdd");

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "tdd",
        description: "Test-driven development.",
      });

      const aliasSource = await resolveInstallSkillSource("mattpocock:tdd", { homeDir });
      const githubSource = await resolveInstallSkillSource("github:mattpocock/skills/skills/tdd", {
        homeDir,
      });

      expect(aliasSource).toEqual({
        kind: "path",
        name: "tdd",
        path: sourceDir,
      });
      expect(githubSource).toEqual(aliasSource);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("resolves upstream canonical and interface craft compatibility sources", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const mappings = [
      ["emilkowalski:emil-design-eng", "interface-craft:design-engineering", "emil-design-eng"],
      [
        "emilkowalski:animation-vocabulary",
        "interface-craft:motion-vocabulary",
        "animation-vocabulary",
      ],
      ["emilkowalski:apple-design", "interface-craft:fluid-interface-design", "apple-design"],
      ["emilkowalski:review-animations", "interface-craft:motion-review", "review-animations"],
    ] as const;

    try {
      for (const [, , installedName] of mappings) {
        await writeSuperpowersSkill(join(homeDir, ".agents", "skills", installedName), {
          name: installedName,
          description: `Interface craft test skill: ${installedName}.`,
        });
      }

      for (const [canonical, legacy, installedName] of mappings) {
        const expected = {
          kind: "path" as const,
          name: installedName,
          path: join(homeDir, ".agents", "skills", installedName),
        };
        await expect(resolveInstallSkillSource(canonical, { homeDir })).resolves.toEqual(expected);
        await expect(resolveInstallSkillSource(legacy, { homeDir })).resolves.toEqual(expected);
      }
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("resolves installed bare skill names from local skill folders", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(homeDir, ".agents", "skills", "implement");

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "implement",
        description: "Implement a piece of work based on a plan.",
      });

      const source = await resolveInstallSkillSource("implement", { homeDir });

      expect(source).toEqual({
        kind: "path",
        name: "implement",
        path: sourceDir,
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("refreshes a skill that is already installed at the target path without deleting it", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(homeDir, ".agents", "skills", "tdd");

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "tdd",
        description: "Test-driven development.",
      });

      const result = await installAgentSkill({
        source: "mattpocock:tdd",
        homeDir,
        agents: ["codex"],
        refreshExisting: true,
      });

      expect(result.skillName).toBe("tdd");
      expect(result.targets).toMatchObject([{ agent: "codex", status: "updated" }]);
      await expect(stat(join(sourceDir, "SKILL.md"))).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".codex", "skills", "tdd", "SKILL.md")),
      ).resolves.toBeTruthy();
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("explains how to install mattpocock skills when they are missing", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      await expect(resolveInstallSkillSource("mattpocock:tdd", { homeDir })).rejects.toThrow(
        `Matt Pocock tdd skill not found under ${homeDir}. Install or refresh Matt Pocock skills with: omniskill skills install mattpocock/skills. Then retry this command. /setup-matt-pocock-skills configures repo metadata after the skills are installed; it does not install tdd.`,
      );
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("installs superpowers brainstorming into directory and Cursor targets", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(
      homeDir,
      ".codex",
      "plugins",
      "cache",
      "openai-curated",
      "superpowers",
      "fake-plugin",
      "skills",
      "brainstorming",
    );

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "brainstorming",
        description: "You MUST use this before any creative work.",
      });

      const result = await installAgentSkill({
        source: "superpowers:brainstorming",
        homeDir,
        agents: ["codex", "cursor"],
      });

      expect(result.skillName).toBe("superpowers-brainstorming");
      expect(result.targets.map((target) => target.status)).toEqual(["installed", "installed"]);

      await expect(
        stat(join(homeDir, ".agents", "skills", "superpowers-brainstorming", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".codex", "skills", "superpowers-brainstorming", "SKILL.md")),
      ).resolves.toBeTruthy();

      const cursorRulePath = join(homeDir, ".cursor", "rules", "superpowers-brainstorming.mdc");
      await expect(stat(cursorRulePath)).resolves.toBeTruthy();
      expect(await readFile(cursorRulePath, "utf8")).toContain("name: brainstorming");
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("installs superpowers writing-plans into directory and Cursor targets", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));
    const sourceDir = join(
      homeDir,
      ".codex",
      "plugins",
      "cache",
      "openai-curated",
      "superpowers",
      "fake-plugin",
      "skills",
      "writing-plans",
    );

    try {
      await writeSuperpowersSkill(sourceDir, {
        name: "writing-plans",
        description: "Use when you have a spec or requirements for a multi-step task.",
      });

      const result = await installAgentSkill({
        source: "superpowers:writing-plans",
        homeDir,
        agents: ["codex", "cursor"],
      });

      expect(result.skillName).toBe("superpowers-writing-plans");
      expect(result.targets.map((target) => target.status)).toEqual(["installed", "installed"]);

      await expect(
        stat(join(homeDir, ".agents", "skills", "superpowers-writing-plans", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".codex", "skills", "superpowers-writing-plans", "SKILL.md")),
      ).resolves.toBeTruthy();

      const cursorRulePath = join(homeDir, ".cursor", "rules", "superpowers-writing-plans.mdc");
      await expect(stat(cursorRulePath)).resolves.toBeTruthy();
      expect(await readFile(cursorRulePath, "utf8")).toContain("name: writing-plans");
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

  test("installs a bundled skill into Claude, Copilot/shared, Codex, Cursor, and opencode targets", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: [...allAgents, "opencode"],
      });

      expect(result.skillName).toBe("pony-trail");
      expect(result.targets.map((target) => target.status)).toEqual([
        "installed",
        "installed",
        "installed",
        "installed",
        "installed",
      ]);
      expect(result.targets).toEqual([
        expect.objectContaining({
          agent: "claude",
          destination: join(homeDir, ".claude", "skills", "pony-trail"),
          artifactPaths: [join(homeDir, ".claude", "skills", "pony-trail")],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "copilot",
          destination: join(homeDir, ".agents", "skills", "pony-trail"),
          artifactPaths: [join(homeDir, ".agents", "skills", "pony-trail")],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "codex",
          destination: join(homeDir, ".agents", "skills", "pony-trail"),
          artifactPaths: [
            join(homeDir, ".agents", "skills", "pony-trail"),
            join(homeDir, ".codex", "skills", "pony-trail"),
          ],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "cursor",
          destination: join(homeDir, ".cursor", "rules", "pony-trail.mdc"),
          artifactPaths: [join(homeDir, ".cursor", "rules", "pony-trail.mdc")],
          status: "installed",
        }),
        expect.objectContaining({
          agent: "opencode",
          destination: join(homeDir, ".agents", "skills", "pony-trail"),
          artifactPaths: [join(homeDir, ".agents", "skills", "pony-trail")],
          status: "installed",
        }),
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
    const codexHooksPath = join(homeDir, ".codex", "hooks.json");

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
      await mkdir(join(homeDir, ".codex"), { recursive: true });
      await writeFile(
        codexHooksPath,
        JSON.stringify(
          {
            hooks: {
              PreToolUse: [
                {
                  matcher: "Edit",
                  hooks: [
                    {
                      type: "command",
                      command:
                        "sh '/Users/roy/.codex/hooks/devcourt-record-change-evidence-prehook.sh'",
                    },
                  ],
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

      const codexHooks = JSON.parse(await readFile(codexHooksPath, "utf8"));
      expect(
        codexHooks.hooks.PreToolUse.some(
          (entry: { matcher?: string; hooks?: Array<{ command?: string }> }) =>
            entry.matcher === "Edit" &&
            entry.hooks?.some((hook) => hook.command?.includes(codexHookPath)),
        ),
      ).toBe(true);
      expect(JSON.stringify(codexHooks.hooks.PreToolUse)).not.toContain(
        "devcourt-record-change-evidence-prehook.sh",
      );

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

  test("does not install prehooks for the opencode shared skill target", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "skill-installer-home-"));

    try {
      const result = await installAgentSkill({
        source: "pony-trail",
        homeDir,
        agents: ["opencode"],
        installPrehook: true,
      });

      expect(result.targets[0]).toMatchObject({
        agent: "opencode",
        status: "installed",
      });
      expect(result.prehooks).toEqual([]);
      await expect(
        stat(join(homeDir, ".agents", "hooks", "ponytrail-prehook.sh")),
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
