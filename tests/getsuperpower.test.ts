import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import {
  configureGetSuperpowerCommand,
  type GetSuperpowerExternalSkillCommand,
  type GetSuperpowerOnboardCommand,
  installExternalSkillDependencyWithSkillsCli,
} from "../src/getsuperpower";
import {
  MissingMattPocockSkillError,
  MissingSuperpowersSkillError,
  type SkillInstallResult,
} from "../src/plugins";
import type { WorkflowGitCommand } from "../src/runtimes/ponytrail/workflow-bundles";

function fakeSkillInstallResult(input: {
  source: string;
  skillName: string;
  destination: string;
}): SkillInstallResult {
  return {
    skillName: input.skillName,
    source: {
      kind: "path",
      name: input.skillName,
      path: input.source,
    },
    dryRun: false,
    targets: [
      {
        agent: "codex",
        destination: input.destination,
        status: "installed",
      },
    ],
    prehooks: [],
  };
}

async function writeGitWorkflowFixture(checkoutDir: string): Promise<void> {
  await mkdir(join(checkoutDir, "skills", "git-entry"), { recursive: true });
  await writeFile(
    join(checkoutDir, "skills", "git-entry", "SKILL.md"),
    [
      "---",
      "name: git-entry",
      'description: "Entry skill from a public git workflow."',
      "---",
      "",
      "# git-entry",
    ].join("\n"),
  );
  await writeFile(
    join(checkoutDir, "workflow.json"),
    JSON.stringify(
      {
        schemaVersion: "0.1",
        name: "git-workflow",
        version: "0.1.0",
        description: "Uses one local skill from git.",
        skills: [{ source: "./skills/git-entry" }],
        steps: [{ id: "entry", title: "Entry", skill: "./skills/git-entry" }],
      },
      null,
      2,
    ),
  );
}

describe("getsuperpower command module", () => {
  test("registers GetSuperpower commands and dependency aliases", () => {
    const program = new Command();

    configureGetSuperpowerCommand(program, {
      rootDir: process.cwd(),
      installSkill: async () => {
        throw new Error("install is not exercised by this registration test");
      },
      printSkillInstallResult: () => {},
    });

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
    ]);
    expect(program.commands.find((command) => command.name() === "deps")?.aliases()).toEqual([
      "dependencies",
      "dependence",
    ]);
  });

  test("clone installs a GetSuperpower through the same install path", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const bundleDir = join(rootDir, "clone-bundle");
    const localSkillDir = join(bundleDir, "skills", "clone-entry");
    const skillInstalls: string[] = [];
    const printedSkills: string[] = [];
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await mkdir(localSkillDir, { recursive: true });
      await writeFile(
        join(localSkillDir, "SKILL.md"),
        [
          "---",
          "name: clone-entry",
          'description: "Entry skill for clone behavior test."',
          "---",
          "",
          "# clone-entry",
        ].join("\n"),
      );
      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "clone-bundle",
            version: "0.1.0",
            description: "Uses one local skill.",
            skills: [{ source: "./skills/clone-entry" }],
            steps: [{ id: "entry", title: "Entry", skill: "./skills/clone-entry" }],
          },
          null,
          2,
        ),
      );

      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async (input) => {
          skillInstalls.push(input.source);
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName: "clone-entry",
              destination: join(homeDir, ".agents", "skills", "clone-entry"),
            }),
          };
        },
        printSkillInstallResult: (result) => {
          printedSkills.push(result.skillName);
        },
      });

      await program.parseAsync(
        ["clone", bundleDir, "--dir", rootDir, "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );

      expect(skillInstalls).toEqual([localSkillDir]);
      expect(printedSkills).toEqual(["clone-entry"]);
      expect(stripAnsiLines(logs)).toContain("GetSuperpower installed: clone-bundle");
      await expect(
        stat(join(rootDir, ".getsuperpower", "workflows", "clone-bundle.json")),
      ).resolves.toBeTruthy();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install supports a public git workflow source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-git-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-git-home-"));
    const source = "https://github.com/acme/git-workflow.git";
    const skillInstalls: string[] = [];
    const printedSkills: string[] = [];
    const commands: WorkflowGitCommand[] = [];
    const program = new Command();
    let checkoutDir = "";

    configureGetSuperpowerCommand(program, {
      rootDir,
      workflowGitCommandRunner: async (command) => {
        commands.push(command);
        if (command.args[0] === "clone") {
          checkoutDir = command.args.at(-1) ?? "";
          await writeGitWorkflowFixture(checkoutDir);
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      },
      installSkill: async (input) => {
        skillInstalls.push(input.source);
        return {
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: join(homeDir, ".agents", "skills", "git-entry"),
          }),
        };
      },
      printSkillInstallResult: (result) => {
        printedSkills.push(result.skillName);
      },
    });

    await program.parseAsync(
      ["install", source, "--dir", rootDir, "--home", homeDir, "--agents", "codex"],
      { from: "user" },
    );

    expect(commands.map((command) => command.args[0])).toEqual(["clone", "rev-parse"]);
    expect(skillInstalls).toEqual([join(checkoutDir, "skills", "git-entry")]);
    expect(printedSkills).toEqual(["git-entry"]);
    const installed = JSON.parse(
      await readFile(join(rootDir, ".getsuperpower", "workflows", "git-workflow.json"), "utf8"),
    );
    expect(installed.source).toEqual({ kind: "git", url: source, commit: "abc123" });
    await expect(stat(checkoutDir)).rejects.toThrow();

    await rm(rootDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  test("validate supports a public git workflow source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-git-validate-"));
    const source = "https://github.com/acme/git-workflow.git";
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    let checkoutDir = "";

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        workflowGitCommandRunner: async (command) => {
          if (command.args[0] === "clone") {
            checkoutDir = command.args.at(-1) ?? "";
            await writeGitWorkflowFixture(checkoutDir);
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
        installSkill: async () => {
          throw new Error("install is not exercised by this validate test");
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["validate", source], { from: "user" });

      expect(stripAnsiLines(logs)).toEqual([
        "GetSuperpower valid: git-workflow@0.1.0",
        "Steps: 1",
        "Skills: 1",
      ]);
      await expect(stat(checkoutDir)).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("deps supports a public git workflow source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-git-deps-"));
    const source = "https://github.com/acme/git-workflow.git";
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    let checkoutDir = "";

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        workflowGitCommandRunner: async (command) => {
          if (command.args[0] === "clone") {
            checkoutDir = command.args.at(-1) ?? "";
            await writeGitWorkflowFixture(checkoutDir);
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
        installSkill: async () => {
          throw new Error("install is not exercised by this deps test");
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["deps", source], { from: "user" });

      expect(stripAnsiLines(logs)).toEqual([
        "GetSuperpower dependencies: git-workflow",
        "- ./skills/git-entry",
      ]);
      await expect(stat(checkoutDir)).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard skips RTK and CodeGraph setup when declined", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-onboard-"));
    const logs: string[] = [];
    const prompts: string[] = [];
    const commands: GetSuperpowerOnboardCommand[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by onboard");
        },
        printSkillInstallResult: () => {},
        onboardPrompt: {
          confirm: async (input) => {
            prompts.push(input.message);
            return false;
          },
        },
        onboardCommandRunner: async (command) => {
          commands.push(command);
          return { stdout: "", stderr: "rtk missing", exitCode: 1 };
        },
      });

      await program.parseAsync(["onboard", "--dir", rootDir], { from: "user" });

      expect(commands).toEqual([
        {
          executable: "rtk",
          args: ["--version"],
          cwd: rootDir,
          env: expect.objectContaining({}),
        },
      ]);
      expect(stripAnsiLines(logs)).toContain("GetSuperpower onboard");
      expect(stripAnsiLines(logs)).toContain(`Workspace: ${rootDir}`);
      expect(prompts).toEqual([
        "RTK is not available. Show RTK setup guidance to reduce Codex token usage?",
        "CodeGraph is not initialized. Index this codebase with CodeGraph now?",
      ]);
      expect(stripAnsiLines(logs)).toContain("RTK setup skipped");
      expect(stripAnsiLines(logs)).toContain("CodeGraph setup skipped");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard prints RTK setup guidance when RTK setup is accepted", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-onboard-"));
    const logs: string[] = [];
    const promptAnswers = [true, false];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by onboard");
        },
        printSkillInstallResult: () => {},
        onboardPrompt: {
          confirm: async () => promptAnswers.shift() ?? false,
        },
        onboardCommandRunner: async () => ({
          stdout: "",
          stderr: "rtk missing",
          exitCode: 1,
        }),
      });

      await program.parseAsync(["onboard", "--dir", rootDir], { from: "user" });

      expect(stripAnsiLines(logs)).toContain("RTK setup guidance");
      expect(stripAnsiLines(logs)).toContain("Install or enable RTK, then verify it with:");
      expect(stripAnsiLines(logs)).toContain("rtk --version");
      expect(stripAnsiLines(logs)).toContain("GetSuperpower onboard complete");
      expect(stripAnsiLines(logs)).toContain("CodeGraph setup skipped");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard fails clearly when the target directory is missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-onboard-"));
    const program = new Command();

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by onboard");
        },
        printSkillInstallResult: () => {},
      });

      await expect(
        program.parseAsync(["onboard", "--dir", "missing"], { from: "user" }),
      ).rejects.toThrow("Onboard target directory does not exist:");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard reports RTK and CodeGraph as ready when both are available", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-onboard-"));
    const logs: string[] = [];
    const prompts: string[] = [];
    const commands: GetSuperpowerOnboardCommand[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await mkdir(join(rootDir, ".codegraph"), { recursive: true });
      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by onboard");
        },
        printSkillInstallResult: () => {},
        onboardPrompt: {
          confirm: async (input) => {
            prompts.push(input.message);
            return true;
          },
        },
        onboardCommandRunner: async (command) => {
          commands.push(command);
          return { stdout: "rtk 1.0.0", stderr: "", exitCode: 0 };
        },
      });

      await program.parseAsync(["onboard", "--dir", rootDir], { from: "user" });

      expect(commands).toEqual([
        {
          executable: "rtk",
          args: ["--version"],
          cwd: rootDir,
          env: expect.objectContaining({}),
        },
      ]);
      expect(prompts).toEqual([]);
      expect(stripAnsiLines(logs)).toContain("GetSuperpower onboard");
      expect(stripAnsiLines(logs)).toContain(`Workspace: ${rootDir}`);
      expect(stripAnsiLines(logs)).toContain("RTK ready");
      expect(stripAnsiLines(logs)).toContain("CodeGraph ready");
      expect(stripAnsiLines(logs)).toContain("GetSuperpower onboard complete");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard runs CodeGraph indexing when confirmed", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-onboard-"));
    const logs: string[] = [];
    const prompts: string[] = [];
    const promptAnswers = [false, true];
    const commands: GetSuperpowerOnboardCommand[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by onboard");
        },
        printSkillInstallResult: () => {},
        onboardPrompt: {
          confirm: async (input) => {
            prompts.push(input.message);
            return promptAnswers.shift() ?? false;
          },
        },
        onboardCommandRunner: async (command) => {
          commands.push(command);
          if (command.executable === "codegraph") {
            return { stdout: "indexed", stderr: "", exitCode: 0 };
          }
          return { stdout: "", stderr: "rtk missing", exitCode: 1 };
        },
      });

      await program.parseAsync(["onboard", "--dir", rootDir], { from: "user" });

      expect(commands).toEqual([
        {
          executable: "rtk",
          args: ["--version"],
          cwd: rootDir,
          env: expect.objectContaining({}),
        },
        {
          executable: "codegraph",
          args: ["init", "-i"],
          cwd: rootDir,
          env: expect.objectContaining({}),
        },
      ]);
      expect(prompts).toHaveLength(2);
      expect(stripAnsiLines(logs)).toContain("RTK setup skipped");
      expect(stripAnsiLines(logs)).toContain("CodeGraph indexed");
      expect(stripAnsiLines(logs)).toContain("GetSuperpower onboard complete");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard reports CodeGraph setup failures with command detail", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-onboard-"));
    const promptAnswers = [false, true];
    const program = new Command();

    try {
      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by onboard");
        },
        printSkillInstallResult: () => {},
        onboardPrompt: {
          confirm: async () => promptAnswers.shift() ?? false,
        },
        onboardCommandRunner: async (command) => {
          if (command.executable === "codegraph") {
            return { stdout: "", stderr: "permission denied", exitCode: 2 };
          }
          return { stdout: "", stderr: "rtk missing", exitCode: 1 };
        },
      });

      await expect(
        program.parseAsync(["onboard", "--dir", rootDir], { from: "user" }),
      ).rejects.toThrow(
        "CodeGraph setup failed while running codegraph init -i: permission denied",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("uses the skills CLI by default before retrying missing external skill installs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const bundleDir = join(rootDir, "matt-bundle");
    const externalInstalls: Array<{ source: string; homeDir: string }> = [];
    const skillInstalls: string[] = [];
    const printedSkills: string[] = [];
    const program = new Command();

    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "matt-bundle",
          version: "0.1.0",
          description: "Uses one Matt Pocock skill.",
          skills: [{ source: "mattpocock:tdd" }],
          steps: [{ id: "tdd", title: "Implement with TDD", skill: "mattpocock:tdd" }],
        },
        null,
        2,
      ),
    );

    configureGetSuperpowerCommand(program, {
      rootDir,
      installSkill: async (input) => {
        skillInstalls.push(input.source);
        if (input.source === "mattpocock:tdd" && skillInstalls.length === 1) {
          throw new MissingMattPocockSkillError({ skillName: "tdd" });
        }

        return {
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "tdd",
            destination: join(homeDir, ".agents", "skills", "tdd"),
          }),
        };
      },
      printSkillInstallResult: (result) => {
        printedSkills.push(result.skillName);
      },
      installExternalSkillDependency: async (input) => {
        externalInstalls.push(input);
      },
    });

    await program.parseAsync(
      ["install", bundleDir, "--dir", rootDir, "--home", homeDir, "--agents", "codex"],
      { from: "user" },
    );

    expect(skillInstalls).toEqual(["mattpocock:tdd", "mattpocock:tdd"]);
    expect(externalInstalls).toEqual([{ source: "mattpocock:tdd", homeDir }]);
    expect(printedSkills).toEqual(["tdd"]);
    await expect(
      stat(join(rootDir, ".getsuperpower", "workflows", "matt-bundle.json")),
    ).resolves.toBeTruthy();
  });

  test("uses the skills CLI once before retrying missing Superpowers workflow skills", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const bundleDir = join(rootDir, "superpowers-bundle");
    const externalInstalls: Array<{ source: string; homeDir: string }> = [];
    const skillInstalls: string[] = [];
    const printedSkills: string[] = [];
    const program = new Command();

    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "superpowers-bundle",
          version: "0.1.0",
          description: "Uses two Superpowers process skills.",
          skills: [
            { source: "superpowers:brainstorming" },
            { source: "superpowers:writing-plans" },
          ],
          steps: [
            {
              id: "brainstorming",
              title: "Shape the work",
              skill: "superpowers:brainstorming",
            },
            {
              id: "planning",
              title: "Write the plan",
              skill: "superpowers:writing-plans",
            },
          ],
        },
        null,
        2,
      ),
    );

    configureGetSuperpowerCommand(program, {
      rootDir,
      installSkill: async (input) => {
        skillInstalls.push(input.source);
        if (input.source === "superpowers:brainstorming" && externalInstalls.length === 0) {
          throw new MissingSuperpowersSkillError({
            displayName: "brainstorming",
            source: "superpowers:brainstorming",
          });
        }

        return {
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: input.source.replace(":", "-"),
            destination: join(homeDir, ".agents", "skills", input.source.replace(":", "-")),
          }),
        };
      },
      printSkillInstallResult: (result) => {
        printedSkills.push(result.skillName);
      },
      installExternalSkillDependency: async (input) => {
        externalInstalls.push(input);
      },
    });

    await program.parseAsync(
      ["install", bundleDir, "--dir", rootDir, "--home", homeDir, "--agents", "codex"],
      { from: "user" },
    );

    expect(skillInstalls).toEqual([
      "superpowers:brainstorming",
      "superpowers:brainstorming",
      "superpowers:writing-plans",
    ]);
    expect(externalInstalls).toEqual([{ source: "superpowers:brainstorming", homeDir }]);
    expect(printedSkills).toEqual(["superpowers-brainstorming", "superpowers-writing-plans"]);
    await expect(
      stat(join(rootDir, ".getsuperpower", "workflows", "superpowers-bundle.json")),
    ).resolves.toBeTruthy();
  });

  test("explains when the skills CLI ran but the dependency is still missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const bundleDir = join(rootDir, "matt-bundle");
    const externalInstalls: Array<{ source: string; homeDir: string }> = [];
    const program = new Command();

    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "matt-bundle",
          version: "0.1.0",
          description: "Uses one Matt Pocock skill.",
          skills: [{ source: "mattpocock:tdd" }],
          steps: [{ id: "tdd", title: "Implement with TDD", skill: "mattpocock:tdd" }],
        },
        null,
        2,
      ),
    );

    configureGetSuperpowerCommand(program, {
      rootDir,
      installSkill: async () => {
        throw new MissingMattPocockSkillError({ skillName: "tdd", homeDir });
      },
      printSkillInstallResult: () => {},
      installExternalSkillDependency: async (input) => {
        externalInstalls.push(input);
      },
    });

    await expect(
      program.parseAsync(
        ["install", bundleDir, "--dir", rootDir, "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      ),
    ).rejects.toThrow(
      "The skills CLI ran for mattpocock/skills, but mattpocock:tdd is still missing.",
    );
    expect(externalInstalls).toEqual([{ source: "mattpocock:tdd", homeDir }]);
  });

  test("installs the skills CLI package non-interactively before adding external dependencies", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const commands: GetSuperpowerExternalSkillCommand[] = [];

    await installExternalSkillDependencyWithSkillsCli({
      source: "mattpocock:tdd",
      homeDir,
      runCommand: async (command) => {
        commands.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    expect(commands).toEqual([
      {
        executable: "npx",
        args: ["--yes", "skills@latest", "add", "mattpocock/skills"],
        cwd: homeDir,
        env: expect.objectContaining({ HOME: homeDir }),
      },
    ]);
  });

  test("installs a bare skills CLI package source non-interactively", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const commands: GetSuperpowerExternalSkillCommand[] = [];

    await installExternalSkillDependencyWithSkillsCli({
      source: "mattpocock/skills",
      homeDir,
      runCommand: async (command) => {
        commands.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    expect(commands).toEqual([
      {
        executable: "npx",
        args: ["--yes", "skills@latest", "add", "mattpocock/skills"],
        cwd: homeDir,
        env: expect.objectContaining({ HOME: homeDir }),
      },
    ]);
  });

  test("installs Superpowers external dependencies from the Superpowers package", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const commands: GetSuperpowerExternalSkillCommand[] = [];

    await installExternalSkillDependencyWithSkillsCli({
      source: "superpowers:brainstorming",
      homeDir,
      runCommand: async (command) => {
        commands.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    expect(commands).toEqual([
      {
        executable: "npx",
        args: ["--yes", "skills@latest", "add", "obra/superpowers"],
        cwd: homeDir,
        env: expect.objectContaining({ HOME: homeDir }),
      },
    ]);
  });
});

function stripAnsiLines(lines: string[]): string[] {
  return lines.map(stripAnsi);
}

function stripAnsi(value: string): string {
  const escapeCharacter = String.fromCharCode(27);
  return value.replace(new RegExp(`${escapeCharacter}\\[[0-?]*[ -/]*[@-~]`, "g"), "");
}
