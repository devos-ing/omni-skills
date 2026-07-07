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
import type { WorkflowGitCommand } from "../src/runtimes/getsuperpower/workflow-bundles";

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

async function writeGitWorkflowFixtureAt(
  workflowDir: string,
  options: { loop?: boolean } = {},
): Promise<void> {
  await mkdir(join(workflowDir, "skills", "git-entry"), { recursive: true });
  await writeFile(
    join(workflowDir, "skills", "git-entry", "SKILL.md"),
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
    join(workflowDir, "workflow.json"),
    JSON.stringify(
      {
        schemaVersion: "0.1",
        name: "git-workflow",
        version: "0.1.0",
        description: "Uses one local skill from git.",
        ...(options.loop
          ? { loop: { script: "./loop.mjs", state: "global", execution: "action-only" } }
          : {}),
        skills: [{ source: "./skills/git-entry", ...(options.loop ? { entry: true } : {}) }],
        steps: [
          {
            id: "entry",
            title: "Entry",
            skill: "./skills/git-entry",
            ...(options.loop ? { instruction: "Check loop status." } : {}),
          },
        ],
      },
      null,
      2,
    ),
  );
}

async function writeGitWorkflowFixture(checkoutDir: string): Promise<void> {
  await writeGitWorkflowFixtureAt(checkoutDir);
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
      "list",
      "deps",
      "onboard",
      "loop",
      "bundle",
      "workflow",
    ]);
    expect(program.commands.find((command) => command.name() === "deps")?.aliases()).toEqual([
      "dependencies",
      "dependence",
    ]);
    expect(
      program.commands
        .find((command) => command.name() === "loop")
        ?.commands.map((command) => command.name()),
    ).toEqual(["start", "status", "log", "advance", "summary"]);
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

  test("install uses a prepared entry skill source for looped workflows", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-loop-install-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-loop-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const skillInstalls: string[] = [];
    const program = new Command();

    await writeGitWorkflowFixtureAt(bundleDir, { loop: true });

    configureGetSuperpowerCommand(program, {
      rootDir,
      installSkill: async (input) => {
        skillInstalls.push(input.source);
        await expect(readFile(join(input.source, "workflow.json"), "utf8")).resolves.toContain(
          '"loop"',
        );
        const generatedRunner = await readFile(join(input.source, "loop.mjs"), "utf8");
        expect(generatedRunner).toContain("GETSUPERPOWER_BIN");
        expect(generatedRunner).toContain("getsuperpower");
        expect(generatedRunner).toContain("workflow.json");
        await expect(readFile(join(input.source, "loop.metadata.json"), "utf8")).resolves.toContain(
          '"workflow": "git-workflow"',
        );
        await expect(stat(join(input.source, "loop-runtime.mjs"))).rejects.toThrow();
        return {
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: join(homeDir, ".agents", "skills", "git-entry"),
          }),
        };
      },
      printSkillInstallResult: () => {},
    });

    await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
      from: "user",
    });

    expect(skillInstalls).toHaveLength(1);
    expect(skillInstalls[0]).toContain("looped-workflow-entry-");

    await rm(rootDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  test("install writes the workflow record to the global home by default", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-default-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-default-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const skillInstalls: string[] = [];
    const program = new Command();

    await writeGitWorkflowFixtureAt(bundleDir);

    configureGetSuperpowerCommand(program, {
      rootDir,
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
      printSkillInstallResult: () => {},
    });

    await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
      from: "user",
    });

    expect(skillInstalls).toEqual([join(bundleDir, "skills", "git-entry")]);
    await expect(
      stat(join(homeDir, ".getsuperpower", "workflows", "git-workflow.json")),
    ).resolves.toBeTruthy();
    await expect(
      stat(join(rootDir, ".getsuperpower", "workflows", "git-workflow.json")),
    ).rejects.toThrow();

    await rm(rootDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  test("list reads workflow records from the global home by default", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-list-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-list-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);

      configureGetSuperpowerCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: join(homeDir, ".agents", "skills", "git-entry"),
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["list", "--home", homeDir], { from: "user" });

      expect(stripAnsiLines(logs)).toContain("git-workflow 0.1.0");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install asks for approval with the declared skill list before installing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-approval-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-approval-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const skillInstalls: string[] = [];
    const prompts: Array<{ workflowName: string; skills: Array<{ source: string }> }> = [];
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);

      configureGetSuperpowerCommand(program, {
        rootDir,
        installPrompt: {
          confirmInstall: async (input) => {
            prompts.push(input);
            return false;
          },
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
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      expect(prompts).toHaveLength(1);
      expect(prompts[0]?.workflowName).toBe("git-workflow");
      expect(prompts[0]?.skills.map((skill) => skill.source)).toEqual(["./skills/git-entry"]);
      expect(stripAnsiLines(logs)).toContain("Skills to install:");
      expect(stripAnsiLines(logs)).toContain("- ./skills/git-entry");
      expect(stripAnsiLines(logs)).toContain("GetSuperpower install cancelled.");
      expect(skillInstalls).toEqual([]);
      await expect(
        stat(join(homeDir, ".getsuperpower", "workflows", "git-workflow.json")),
      ).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install shows progress and a bordered GETSUPERPOWER result when approved", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-progress-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-progress-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);

      configureGetSuperpowerCommand(program, {
        rootDir,
        installPrompt: {
          confirmInstall: async () => true,
        },
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: join(homeDir, ".agents", "skills", "git-entry"),
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      const output = stripAnsiLines(logs).join("\n");
      expect(output).toContain("Installing skills...");
      expect(output).toContain("Processing 1/1: ./skills/git-entry");
      expect(output).toContain("Installed skill: git-entry");
      expect(output).toContain("+");
      expect(output).toContain("GETSUPERPOWER");
      expect(output).toContain("GetSuperpower installed: git-workflow");
      expect(output).toContain(
        `GetSuperpower file: ${join(homeDir, ".getsuperpower", "workflows", "git-workflow.json")}`,
      );
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install supports a workflow alias source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-alias-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-alias-home-"));
    const source = "openspec-superpowers";
    const canonicalUrl =
      "https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers";
    const skillInstalls: string[] = [];
    const printedSkills: string[] = [];
    const commands: WorkflowGitCommand[] = [];
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
          commands.push(command);
          if (command.args[0] === "clone") {
            checkoutDir = command.args.at(-1) ?? "";
            await writeGitWorkflowFixtureAt(
              join(checkoutDir, "examples", "workflows", "openspec-superpowers"),
            );
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

      expect(commands[0]?.args).toEqual([
        "clone",
        "--depth",
        "1",
        "https://github.com/0xroylee/getsuperpower.git",
        checkoutDir,
      ]);
      expect(skillInstalls).toEqual([
        join(checkoutDir, "examples", "workflows", "openspec-superpowers", "skills", "git-entry"),
      ]);
      expect(printedSkills).toEqual(["git-entry"]);
      expect(stripAnsiLines(logs)).toContain("GetSuperpower installed: git-workflow");
      expect(stripAnsiLines(logs).join("\n")).not.toContain(canonicalUrl);
      const installed = JSON.parse(
        await readFile(join(rootDir, ".getsuperpower", "workflows", "git-workflow.json"), "utf8"),
      );
      expect(installed.source).toEqual({
        kind: "git",
        url: canonicalUrl,
        commit: "abc123",
        subdirectory: "examples/workflows/openspec-superpowers",
      });
      await expect(stat(checkoutDir)).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
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

  test("validate supports a workflow alias source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-alias-validate-"));
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
            await writeGitWorkflowFixtureAt(
              join(checkoutDir, "examples", "workflows", "openspec-superpowers"),
            );
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
        installSkill: async () => {
          throw new Error("install is not exercised by this validate test");
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["validate", "openspec-superpowers"], { from: "user" });

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

  test("deps supports a workflow alias source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-alias-deps-"));
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
            await writeGitWorkflowFixtureAt(
              join(checkoutDir, "examples", "workflows", "openspec-superpowers"),
            );
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
        installSkill: async () => {
          throw new Error("install is not exercised by this deps test");
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["deps", "openspec-superpowers"], { from: "user" });

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
    const externalInstalls: Array<{ source: string; repo?: string; homeDir: string }> = [];
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
          skills: [{ source: "mattpocock:tdd", repo: "mattpocock/skills" }],
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
    expect(externalInstalls).toEqual([
      { source: "mattpocock:tdd", repo: "mattpocock/skills", homeDir },
    ]);
    expect(printedSkills).toEqual(["tdd"]);
    await expect(
      stat(join(rootDir, ".getsuperpower", "workflows", "matt-bundle.json")),
    ).resolves.toBeTruthy();
  });

  test("uses the skills CLI before retrying each missing Superpowers workflow skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const bundleDir = join(rootDir, "superpowers-bundle");
    const externalInstalls: Array<{ source: string; repo?: string; homeDir: string }> = [];
    const skillInstalls: string[] = [];
    const printedSkills: string[] = [];
    const installedExternalSources = new Set<string>();
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
            { source: "superpowers:writing-plans", repo: "obra/superpowers" },
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
        if (
          (input.source === "superpowers:brainstorming" ||
            input.source === "superpowers:writing-plans") &&
          !installedExternalSources.has(input.source)
        ) {
          throw new MissingSuperpowersSkillError({
            displayName: input.source.replace("superpowers:", ""),
            source: input.source,
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
        installedExternalSources.add(input.source);
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
      "superpowers:writing-plans",
    ]);
    expect(externalInstalls).toEqual([
      { source: "superpowers:brainstorming", homeDir },
      { source: "superpowers:writing-plans", repo: "obra/superpowers", homeDir },
    ]);
    expect(printedSkills).toEqual(["superpowers-brainstorming", "superpowers-writing-plans"]);
    await expect(
      stat(join(rootDir, ".getsuperpower", "workflows", "superpowers-bundle.json")),
    ).resolves.toBeTruthy();
  });

  test("explains when the skills CLI ran but the dependency is still missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "getsuperpower-"));
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const bundleDir = join(rootDir, "matt-bundle");
    const externalInstalls: Array<{ source: string; repo?: string; homeDir: string }> = [];
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
          skills: [{ source: "mattpocock:tdd", repo: "mattpocock/skills" }],
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
    expect(externalInstalls).toEqual([
      { source: "mattpocock:tdd", repo: "mattpocock/skills", homeDir },
    ]);
  });

  test("installs the declared skills CLI repo non-interactively before adding external dependencies", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const commands: GetSuperpowerExternalSkillCommand[] = [];

    await installExternalSkillDependencyWithSkillsCli({
      source: "mattpocock:tdd",
      repo: "mattpocock/skills",
      homeDir,
      runCommand: async (command) => {
        commands.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    expect(commands).toEqual([
      {
        executable: "npx",
        args: [
          "--yes",
          "skills@latest",
          "add",
          "mattpocock/skills",
          "--yes",
          "--global",
          "--skill",
          "tdd",
          "--agent",
          "codex",
        ],
        cwd: homeDir,
        env: expect.objectContaining({ HOME: homeDir }),
      },
    ]);
  });

  test("normalizes markdown repository links before invoking the Skills CLI", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "getsuperpower-home-"));
    const commands: GetSuperpowerExternalSkillCommand[] = [];

    await installExternalSkillDependencyWithSkillsCli({
      source: "superpowers:brainstorming",
      repo: "[obra/superpowers](https://github.com/obra/superpowers)",
      homeDir,
      runCommand: async (command) => {
        commands.push(command);
        return { stdout: "", stderr: "", exitCode: 0 };
      },
    });

    expect(commands[0]?.args).toEqual([
      "--yes",
      "skills@latest",
      "add",
      "obra/superpowers",
      "--yes",
      "--global",
      "--skill",
      "brainstorming",
      "--agent",
      "codex",
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
        args: ["--yes", "skills@latest", "add", "mattpocock/skills", "--yes", "--global"],
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
        args: [
          "--yes",
          "skills@latest",
          "add",
          "obra/superpowers",
          "--yes",
          "--global",
          "--skill",
          "brainstorming",
          "--agent",
          "codex",
        ],
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
