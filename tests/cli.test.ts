import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildProgram, type RevertApprovalPrompter } from "../src/cli";

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
  test("registers GetSuperpower, skill, and snapshot commands only", () => {
    const program = buildProgram();

    expect(program.name()).toBe("ponyrace");
    expect(program.commands.map((command) => command.name())).toEqual([
      "history",
      "revert",
      "getsuperpower",
      "bundle",
      "workflow",
      "skills",
    ]);
    for (const removedCommand of [
      "setup",
      "onboard",
      "bots",
      "goal",
      "ponyrace",
      "vote",
      "stream-goal",
    ]) {
      expect(program.commands.some((command) => command.name() === removedCommand)).toBe(false);
    }

    const revertCommand = program.commands.find((command) => command.name() === "revert");
    const getsuperpowerCommand = program.commands.find(
      (command) => command.name() === "getsuperpower",
    );
    const bundleCommand = program.commands.find((command) => command.name() === "bundle");
    const workflowCommand = program.commands.find((command) => command.name() === "workflow");
    const skillsCommand = program.commands.find((command) => command.name() === "skills");

    expect(revertCommand?.options.map((option) => option.long)).toEqual(["--dry-run"]);
    expect(getsuperpowerCommand?.commands.map((command) => command.name())).toEqual([
      "init",
      "validate",
      "install",
      "list",
      "deps",
    ]);
    expect(getsuperpowerCommand?.commands.at(-1)?.aliases()).toEqual([
      "dependencies",
      "dependence",
    ]);
    expect(bundleCommand?.commands.map((command) => command.name())).toEqual(["init", "validate"]);
    expect(workflowCommand?.commands.map((command) => command.name())).toEqual(["install", "list"]);
    expect(skillsCommand?.commands.map((command) => command.name())).toEqual(["install", "update"]);
  });

  test("prints the CLI version with -v", async () => {
    const program = buildProgram();
    const expectedVersion = "0.2.0";
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

  test("workflow install installs product-dev skills and lists the installed GetSuperpower", async () => {
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
        ["workflow", "install", "product-dev", "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await buildProgram({ cwd: rootDir }).parseAsync(["workflow", "list"], { from: "user" });

      await expect(
        stat(join(rootDir, ".ponyrace", "workflows", "product-dev.json")),
      ).resolves.toBeTruthy();
      for (const skill of [
        "superpowers-brainstorming",
        "superpowers-writing-plans",
        "pony-trail",
      ]) {
        await expect(
          stat(join(homeDir, ".agents", "skills", skill, "SKILL.md")),
        ).resolves.toBeTruthy();
      }
      expect(stripAnsiLines(logs)).toContain("GetSuperpower installed: product-dev");
      expect(stripAnsiLines(logs)).toContain("product-dev 0.1.0");
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
      await buildProgram().parseAsync(
        ["getsuperpower", "deps", "examples/workflows/real-engineering"],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("GetSuperpower dependencies: real-engineering");
      expect(stripAnsiLines(logs)).toContain("- ./skills/rtk-command-discipline");
      expect(stripAnsiLines(logs)).toContain("- pony-trail");
      expect(stripAnsiLines(logs)).toContain("- superpowers:brainstorming");
      expect(stripAnsiLines(logs)).toContain("- mattpocock:tdd");
    } finally {
      console.log = originalLog;
    }
  });

  test("skills install dry-runs bundled pony trail skill installation for npx and bunx usage", async () => {
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

  test("skills install records failed external package installs", async () => {
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

      const history = await readSnapshotEntries(rootDir);
      expect(history.map((entry) => entry.phase)).toEqual(["pre", "post"]);
      expect(history.at(-1)?.result).toBe("fail: skills cli unavailable");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install records failed local skill installs", async () => {
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

      const history = await readSnapshotEntries(rootDir);
      expect(history.map((entry) => entry.phase)).toEqual(["pre", "post"]);
      expect(history.at(-1)?.result).toContain("fail: Matt Pocock tdd skill not found");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills install can dry-run prehook installation", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "ponytrail-skill-home-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: homeDir }).parseAsync(
        [
          "skills",
          "install",
          "pony-trail",
          "--home",
          homeDir,
          "--agents",
          "codex,copilot",
          "--prehook",
          "--dry-run",
        ],
        { from: "user" },
      );

      expect(stripAnsiLines(logs)).toContain("Prehook install plan");
      expect(logs.some((line) => line.includes("codex: would install"))).toBe(true);
      expect(logs.some((line) => line.includes("copilot: would install"))).toBe(true);
    } finally {
      console.log = originalLog;
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

  test("skills install records a local project history commit", async () => {
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

      const history = JSON.parse(
        await readFile(join(rootDir, ".ponyrace", "snapshots.jsonl"), "utf8").then(
          (value) => `[${value.trim().split("\n").join(",")}]`,
        ),
      );
      expect(history.map((entry: { phase: string }) => entry.phase)).toEqual(["pre", "post"]);
      expect(logs.some((line) => line.includes("Local history:"))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skills update refreshes installed skill files and records a local project history commit", async () => {
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
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("history prints empty state, accepts simple mode, and rejects unknown modes", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await buildProgram({ cwd: rootDir }).parseAsync(["history"], { from: "user" });
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--mode", "simple"], {
        from: "user",
      });
      await expect(
        buildProgram({ cwd: rootDir }).parseAsync(["history", "--mode", "sideways"], {
          from: "user",
        }),
      ).rejects.toThrow("Unknown history mode: sideways");

      expect(
        stripAnsiLines(logs).filter((line) => line === "No snapshot history found."),
      ).toHaveLength(2);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("history supports tree, details, and JSON output", async () => {
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
      await buildProgram({ cwd: rootDir }).parseAsync(["history"], { from: "user" });
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--details"], { from: "user" });
      await buildProgram({ cwd: rootDir }).parseAsync(["history", "--json"], { from: "user" });

      expect(logs.some((line) => line.includes("Snapshot history"))).toBe(true);
      expect(logs.some((line) => line.includes("action: install skill"))).toBe(true);
      expect(logs.some((line) => line.includes('"sessions"'))).toBe(true);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("revert dry-run prints planned snapshot actions without mutating files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const targetPath = join(rootDir, "notes.txt");
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeFile(targetPath, "before\n");
      await writeManualSnapshot(rootDir, "snapshot-001", "notes.txt");
      await writeFile(targetPath, "after\n");

      await buildProgram({ cwd: rootDir }).parseAsync(["revert", "snapshot-001", "--dry-run"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain("Snapshot revert plan");
      expect(logs.some((line) => line.includes("Would restore notes.txt"))).toBe(true);
      expect(await readFile(targetPath, "utf8")).toBe("after\n");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert cancellation leaves files unchanged", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const targetPath = join(rootDir, "notes.txt");
    const logs: string[] = [];
    const originalLog = console.log;

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeFile(targetPath, "before\n");
      await writeManualSnapshot(rootDir, "snapshot-001", "notes.txt");
      await writeFile(targetPath, "after\n");

      await buildProgram({
        cwd: rootDir,
        revertApprovalPrompter: async () => false,
      }).parseAsync(["revert", "snapshot-001"], { from: "user" });

      expect(stripAnsiLines(logs)).toContain("Revert cancelled.");
      expect(await readFile(targetPath, "utf8")).toBe("after\n");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert defaults to cancellation in non-interactive terminals", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const targetPath = join(rootDir, "notes.txt");
    const logs: string[] = [];
    const originalLog = console.log;
    const originalDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      Object.defineProperty(process.stdin, "isTTY", {
        configurable: true,
        value: false,
      });
      await writeFile(targetPath, "before\n");
      await writeManualSnapshot(rootDir, "snapshot-001", "notes.txt");
      await writeFile(targetPath, "after\n");

      await buildProgram({ cwd: rootDir }).parseAsync(["revert", "snapshot-001"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain(
        "Run from an interactive terminal to approve the revert.",
      );
      expect(stripAnsiLines(logs)).toContain("Revert cancelled.");
      expect(await readFile(targetPath, "utf8")).toBe("after\n");
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(process.stdin, "isTTY", originalDescriptor);
      }
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("revert asks for approval before applying", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "ponytrail-cli-"));
    const targetPath = join(rootDir, "notes.txt");
    const approvals: string[] = [];
    const originalLog = console.log;

    console.log = () => {};

    try {
      await writeFile(targetPath, "before\n");
      await writeManualSnapshot(rootDir, "snapshot-001", "notes.txt");
      await writeFile(targetPath, "after\n");
      const revertApprovalPrompter: RevertApprovalPrompter = async ({ snapshotId }) => {
        approvals.push(snapshotId);
        return true;
      };

      await buildProgram({ cwd: rootDir, revertApprovalPrompter }).parseAsync(
        ["revert", "snapshot-001"],
        { from: "user" },
      );

      expect(approvals).toEqual(["snapshot-001"]);
      expect(await readFile(targetPath, "utf8")).toBe("before\n");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });
});

async function writeManualSnapshot(
  rootDir: string,
  snapshotId: string,
  relativePath: string,
): Promise<void> {
  const snapshotDir = join(rootDir, ".ponyrace");
  await mkdir(join(snapshotDir, "files", snapshotId, "pre"), { recursive: true });
  await writeFile(join(snapshotDir, "files", snapshotId, "pre", relativePath), "before\n");
  await writeFile(
    join(snapshotDir, "snapshots.jsonl"),
    `${JSON.stringify({
      session_id: "manual",
      snapshot_id: snapshotId,
      phase: "pre",
      timestamp_utc: "2026-06-30T00:00:00.000Z",
      action: "manual",
      purpose: "test revert",
      reason: "test revert",
      expected: "pre copy exists",
      verify: "dry run",
      rollback: "restore",
      files: [
        {
          path: relativePath,
          exists: true,
          sha256: "abc",
          stored_copy: `files/${snapshotId}/pre/${relativePath}`,
        },
      ],
    })}\n`,
  );
}

function stripAnsiLines(lines: string[]): string[] {
  return lines.map(stripAnsi);
}

function stripAnsi(value: string): string {
  const escapeCharacter = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeCharacter}\\[[0-?]*[ -/]*[@-~]`, "g"), "");
}

async function readSnapshotEntries(
  rootDir: string,
): Promise<Array<{ phase: string; result?: string }>> {
  return JSON.parse(
    await readFile(join(rootDir, ".ponyrace", "snapshots.jsonl"), "utf8").then(
      (value) => `[${value.trim().split("\n").join(",")}]`,
    ),
  );
}
