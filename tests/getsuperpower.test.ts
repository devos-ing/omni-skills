import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Command } from "commander";
import {
  configureGetSuperpowerCommand,
  type GetSuperpowerExternalSkillCommand,
  installExternalSkillDependencyWithSkillsCli,
} from "../src/getsuperpower";
import { MissingMattPocockSkillError, type SkillInstallResult } from "../src/plugins";

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
      expect(logs).toContain("GetSuperpower installed: clone-bundle");
      await expect(
        stat(join(rootDir, ".getsuperpower", "workflows", "clone-bundle.json")),
      ).resolves.toBeTruthy();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
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
});
