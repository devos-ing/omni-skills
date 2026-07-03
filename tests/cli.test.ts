import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram } from "../src/cli";

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
    ].join("\n"),
  );
}

async function writeSuperpowersProcessSkills(homeDir: string): Promise<void> {
  const baseDir = join(
    homeDir,
    ".codex",
    "plugins",
    "cache",
    "openai-curated",
    "superpowers",
    "fake-plugin",
    "skills",
  );

  await writeSuperpowersSkill(join(baseDir, "brainstorming"), {
    name: "brainstorming",
    description: "You MUST use this before any creative work.",
  });
  await writeSuperpowersSkill(join(baseDir, "writing-plans"), {
    name: "writing-plans",
    description: "Use when you have a spec or requirements for a multi-step task.",
  });
}

describe("cli", () => {
  const releaseReviewWorkflow = join(
    import.meta.dir,
    "..",
    "examples",
    "workflows",
    "release-review",
  );

  test("registers GetSuperpower and skill commands only", () => {
    const program = buildProgram();

    expect(program.name()).toBe("getsuperpower");
    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "validate",
      "install",
      "clone",
      "list",
      "deps",
      "onboard",
      "bundle",
      "workflow",
      "skills",
    ]);
    for (const removedCommand of [
      "setup",
      "bots",
      "goal",
      "ponyrace",
      "vote",
      "stream-goal",
      "history",
      "revert",
    ]) {
      expect(program.commands.some((command) => command.name() === removedCommand)).toBe(false);
    }

    const rootDepsCommand = program.commands.find((command) => command.name() === "deps");
    const bundleCommand = program.commands.find((command) => command.name() === "bundle");
    const workflowCommand = program.commands.find((command) => command.name() === "workflow");
    const skillsCommand = program.commands.find((command) => command.name() === "skills");

    expect(rootDepsCommand?.aliases()).toEqual(["dependencies", "dependence"]);
    expect(bundleCommand?.commands.map((command) => command.name())).toEqual(["init", "validate"]);
    expect(workflowCommand?.commands.map((command) => command.name())).toEqual(["install", "list"]);
    expect(skillsCommand?.commands.map((command) => command.name())).toEqual(["install", "update"]);
    expect(
      skillsCommand?.commands
        .find((command) => command.name() === "install")
        ?.options.map((option) => option.long),
    ).not.toContain("--prehook");
  });

  test("root help presents the GetSuperpower welcome", () => {
    const program = buildProgram();
    const output: string[] = [];

    program.configureOutput({
      writeOut: (value) => output.push(value),
      writeErr: (value) => output.push(value),
    });
    program.outputHelp();

    const help = stripAnsi(output.join(""));

    expect(help).toContain("GETSUPERPOWER");
    expect(help).toContain("Welcome to GetSuperpower.");
    expect(help).toContain("Install and author workflow skill trees for agent work.");
    expect(help).toContain("getsuperpower init release-review");
    expect(help).toContain("getsuperpower validate ./release-review");
    expect(help).toContain("getsuperpower clone https://github.com/acme/release-review.git");
    expect(help).toContain("getsuperpower install ./release-review");
    expect(help).toContain("getsuperpower deps ./release-review");
    expect(help).toContain("bundle");
    expect(help).toContain("Compatibility alias for GetSuperpower authoring.");
    expect(help).not.toContain("ponyrace");
    expect(help).not.toContain("history");
    expect(help).not.toContain("revert");
  });

  test("no-command invocation prints welcome help", async () => {
    const program = buildProgram();
    const output: string[] = [];

    program.exitOverride();
    program.configureOutput({
      writeOut: (value) => output.push(value),
      writeErr: (value) => output.push(value),
    });

    await expect(program.parseAsync([], { from: "user" })).rejects.toMatchObject({
      code: "commander.help",
      exitCode: 0,
    });

    const text = stripAnsi(output.join(""));
    expect(text).toContain("GETSUPERPOWER");
    expect(text).toContain("Welcome to GetSuperpower.");
    expect(text).toContain("Usage: getsuperpower");
  });

  test("prints the CLI version with -v", async () => {
    const program = buildProgram();
    const expectedVersion = "0.3.1";
    const output: string[] = [];

    expect(program.version()).toBe(expectedVersion);

    program.exitOverride();
    program.configureOutput({
      writeOut: (value) => output.push(value),
      writeErr: (value) => output.push(value),
    });

    await expect(program.parseAsync(["-v"], { from: "user" })).rejects.toMatchObject({
      code: "commander.version",
      exitCode: 0,
      message: expectedVersion,
    });
    expect(output.join("")).toBe(`${expectedVersion}\n`);
  });

  test("bundle init creates an authorable GetSuperpower and validate accepts it", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-bundle-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["bundle", "init", "release-review", "--dir", "bundles"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["bundle", "validate", "bundles/release-review"],
        { from: "user" },
      );

      await expect(
        stat(join(rootDir, "bundles", "release-review", "workflow.json")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(rootDir, "bundles", "release-review", "skills", "release-review", "SKILL.md")),
      ).resolves.toBeTruthy();
      await expect(
        stat(join(rootDir, "bundles", "release-review", "skills", "custom-review", "SKILL.md")),
      ).resolves.toBeTruthy();
      expect(stripAnsiLines(logs)).toContain(
        `GetSuperpower created: ${join(rootDir, "bundles", "release-review")}`,
      );
      expect(stripAnsiLines(logs)).toContain("GetSuperpower valid: release-review@0.1.0");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("workflow install installs example workflow skills and lists the installed GetSuperpower", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-workflow-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-workflow-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSuperpowersProcessSkills(homeDir);

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["workflow", "install", releaseReviewWorkflow, "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(["workflow", "list"], { from: "user" });

      await expect(
        stat(join(rootDir, ".getsuperpower", "workflows", "release-review.json")),
      ).resolves.toBeTruthy();
      for (const skill of [
        "release-risk-review",
        "superpowers-brainstorming",
        "superpowers-writing-plans",
        "pony-trail",
      ]) {
        await expect(
          stat(join(homeDir, ".agents", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
      }
      expect(stripAnsiLines(logs)).toContain("GetSuperpower installed: release-review");
      expect(stripAnsiLines(logs)).toContain("release-review 0.1.0");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("clone installs example workflow skills and records the workflow from the root command", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-clone-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-clone-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeSuperpowersProcessSkills(homeDir);

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["clone", releaseReviewWorkflow, "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      await expect(
        stat(join(rootDir, ".getsuperpower", "workflows", "release-review.json")),
      ).resolves.toBeTruthy();
      for (const skill of [
        "release-risk-review",
        "superpowers-brainstorming",
        "superpowers-writing-plans",
        "pony-trail",
      ]) {
        await expect(
          stat(join(homeDir, ".agents", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
      }
      expect(stripAnsiLines(logs)).toContain("GetSuperpower installed: release-review");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("getsuperpower deps prints the skill dependencies for a GetSuperpower", async () => {
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram().parseAsync(["deps", "examples/workflows/real-engineering"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain("GetSuperpower dependencies: real-engineering");
      expect(stripAnsiLines(logs)).toContain("- ./skills/rtk-command-discipline");
      expect(stripAnsiLines(logs)).toContain("- pony-trail");
      expect(stripAnsiLines(logs)).toContain("- superpowers:brainstorming");
      expect(stripAnsiLines(logs)).toContain("- mattpocock:tdd");
    } finally {
      console.log = originalLog;
    }
  });

  test("skills install defaults to the bundle authoring helper", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: homeDir }).parseAsync(
        ["skills", "install", "--home", homeDir, "--dry-run"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Skill install plan");
      expect(logs.some((line) => line.includes("creating-bundle-skills"))).toBe(true);
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install can still install pony-trail when requested explicitly", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: homeDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--dry-run"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Skill install plan");
      expect(logs.some((line) => line.includes("pony-trail"))).toBe(true);
      expect(logs.some((line) => line.includes("claude: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install can delegate external skills packages to the Skills CLI", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const externalInstalls: Array<{ source: string; homeDir: string }> = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({
        cwd: rootDir,
        installExternalSkillDependency: async (input) => {
          externalInstalls.push({ source: input.source, homeDir: input.homeDir });
        },
      }).parseAsync(["skills", "install", "mattpocock/skills", "--home", homeDir], {
        from: "user",
      });

      expect(externalInstalls).toEqual([{ source: "mattpocock/skills", homeDir }]);
      expect(stripAnsiLines(logs)).toContain("Skills package install result");
      expect(logs.some((line) => line.includes("Package: mattpocock/skills"))).toBe(true);
      expect(
        logs.some((line) =>
          line.includes("Internal command: npx --yes skills@latest add mattpocock/skills"),
        ),
      ).toBe(true);
      expect(logs.some((line) => line.includes(homeDir))).toBe(true);
      expect(logs.some((line) => line.includes("Restart your agent IDE"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install dry-runs external skills packages without invoking the Skills CLI", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const externalInstalls: Array<{ source: string; homeDir: string }> = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({
        cwd: rootDir,
        installExternalSkillDependency: async (input) => {
          externalInstalls.push({ source: input.source, homeDir: input.homeDir });
        },
      }).parseAsync(["skills", "install", "mattpocock/skills", "--home", homeDir, "--dry-run"], {
        from: "user",
      });

      expect(externalInstalls).toEqual([]);
      expect(stripAnsiLines(logs)).toContain("Skills package install plan");
      expect(logs.some((line) => line.includes("Package: mattpocock/skills"))).toBe(true);
      expect(logs.some((line) => line.includes("Restart your agent IDE"))).toBe(false);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install does not record failed external package installs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const originalLog = console.log;

    console.log = () => {};

    try {
      await expect(
        buildProgram({
          cwd: rootDir,
          installExternalSkillDependency: async () => {
            throw new Error("skills cli unavailable");
          },
        }).parseAsync(["skills", "install", "mattpocock/skills", "--home", homeDir], {
          from: "user",
        }),
      ).rejects.toThrow("skills cli unavailable");

      await expect(stat(join(rootDir, ".getsuperpower", "snapshots.jsonl"))).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install does not record failed local skill installs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const originalLog = console.log;

    console.log = () => {};

    try {
      await expect(
        buildProgram({ cwd: rootDir }).parseAsync(
          ["skills", "install", "mattpocock:tdd", "--home", homeDir, "--agents", "codex"],
          { from: "user" },
        ),
      ).rejects.toThrow("Matt Pocock tdd skill not found");

      await expect(stat(join(rootDir, ".getsuperpower", "snapshots.jsonl"))).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install and update report existing target states", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex", "--dry-run"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        [
          "skills",
          "install",
          "pony-trail",
          "--home",
          homeDir,
          "--agents",
          "codex",
          "--dry-run",
          "--force",
        ],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex", "--force"],
        { from: "user" },
      );
      await writeFile(
        join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md"),
        "stale installed copy",
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "update", "pony-trail", "--home", homeDir, "--agents", "codex", "--dry-run"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "update", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "update", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      expect(logs.some((line) => line.includes("codex: skipped existing"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would overwrite"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: overwritten"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: would update"))).toBe(true);
      expect(logs.some((line) => line.includes("codex: already present"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install supports home path shorthands in dry-run mode", async () => {
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram().parseAsync(
        ["skills", "install", "pony-trail", "--home", "~", "--dry-run"],
        {
          from: "user",
        },
      );
      await buildProgram().parseAsync(
        ["skills", "install", "pony-trail", "--home", "~/getsuperpower-test", "--dry-run"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs).filter((line) => line === "Skill install plan")).toHaveLength(2);
    } finally {
      console.log = originalLog;
    }
  });

  test("skills install does not create local snapshot history", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      await expect(stat(join(rootDir, ".getsuperpower", "snapshots.jsonl"))).rejects.toThrow();
      expect(logs.some((line) => line.includes("Local history:"))).toBe(false);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills update refreshes installed skill files without local snapshot history", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "install", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await writeFile(
        join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md"),
        "stale installed copy",
      );

      await buildProgram({ cwd: rootDir }).parseAsync(
        ["skills", "update", "pony-trail", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      expect(
        await readFile(join(homeDir, ".agents", "skills", "pony-trail", "SKILL.md"), "utf8"),
      ).toContain("name: pony-trail");
      expect(logs.some((line) => line.includes("Skill update result"))).toBe(true);
      expect(logs.some((line) => line.includes("Local history:"))).toBe(false);
      await expect(stat(join(rootDir, ".getsuperpower", "snapshots.jsonl"))).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});

function stripAnsiLines(lines: string[]): string[] {
  return lines.map(stripAnsi);
}

function stripAnsi(value: string): string {
  const escapeCharacter = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeCharacter}\\[[0-?]*[ -/]*[@-~]`, "g"), "");
}
