import { describe, expect, test } from "bun:test";
import { cp, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { Command } from "commander";
import {
  configureOmniskillCommand,
  installExternalSkillDependencyWithSkillsCli,
  type OmniskillExternalSkillCommand,
  type OmniskillOnboardCommand,
} from "../src/omniskill";
import {
  installAgentSkill,
  MissingMattPocockSkillError,
  MissingSuperpowersSkillError,
  type SkillInstallResult,
  SkillSourceNotFoundError,
} from "../src/plugins";
import type { WorkflowGitCommand } from "../src/runtimes/omniskill/workflow-bundles";

const mattPocockV1_1Repo =
  "https://github.com/mattpocock/skills/tree/d574778f94cf620fcc8ce741584093bc650a61d3";
const testCodexModelCatalog = async () => [
  {
    slug: "gpt-5.5",
    visibility: "list",
    priority: 0,
    supportedReasoningEfforts: ["low", "medium", "high"] as const,
  },
  {
    slug: "codex-auto-review",
    visibility: "hidden",
    priority: 1,
    supportedReasoningEfforts: ["high"] as const,
  },
];

function fakeSkillInstallResult(input: {
  source: string;
  skillName: string;
  destination: string;
  artifactPaths?: string[];
  status?: "installed" | "updated" | "already_present";
  createdByBootstrap?: boolean;
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
        artifactPaths: input.artifactPaths ?? [input.destination],
        status: input.status ?? "installed",
        ...(input.createdByBootstrap ? { createdByBootstrap: true } : {}),
      },
    ],
  };
}

async function writeGitWorkflowFixtureAt(
  workflowDir: string,
  options: {
    loop?: boolean;
    version?: string;
    extraSkill?: boolean;
    team?: boolean;
    localTeamMember?: boolean;
    orchestration?: boolean;
    repoBackedRole?: boolean;
  } = {},
): Promise<void> {
  const includeExtraSkill = options.extraSkill === true;
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
  if (includeExtraSkill || options.team) {
    const extraSkillDir =
      options.team && !options.localTeamMember
        ? join(workflowDir, "member-workflow", "skills", "git-extra")
        : join(workflowDir, "skills", "git-extra");
    await mkdir(extraSkillDir, { recursive: true });
    await writeFile(
      join(extraSkillDir, "SKILL.md"),
      [
        "---",
        "name: git-extra",
        'description: "Extra skill from a public git workflow."',
        "---",
        "",
        "# git-extra",
      ].join("\n"),
    );
  }
  if (options.team && !options.localTeamMember) {
    await writeFile(
      join(workflowDir, "member-workflow", "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "git-member",
          version: "1.0.0",
          description: "Canonical member workflow.",
          skills: [{ source: "./skills/git-extra", entry: true }],
          steps: [{ id: "member", title: "Member", skill: "./skills/git-extra" }],
        },
        null,
        2,
      ),
    );
  }
  await writeFile(
    join(workflowDir, "workflow.json"),
    JSON.stringify(
      {
        schemaVersion: "0.1",
        ...(options.team
          ? {
              kind: "team",
              name: "git-team",
              coordinator: "./skills/git-entry",
              members: [options.localTeamMember ? "./skills/git-extra" : "./member-workflow"],
            }
          : { name: "git-workflow" }),
        version: options.version ?? "0.1.0",
        description: "Uses one local skill from git.",
        ...(options.loop
          ? { loop: { script: "./loop.mjs", state: "global", execution: "action-only" } }
          : {}),
        ...(options.team && options.orchestration
          ? {
              orchestration: {
                roles: {
                  "./skills/git-entry": {
                    tier: "deep",
                    access: "read-only",
                    consultation: "receive",
                  },
                  [options.localTeamMember ? "./skills/git-extra" : "./member-workflow"]: {
                    tier: "standard",
                    access: "workspace-write",
                    consultation: "request",
                  },
                  ...(options.repoBackedRole
                    ? {
                        "custom-review": {
                          tier: "deep",
                          access: "read-only",
                          consultation: "request",
                        },
                      }
                    : {}),
                },
              },
            }
          : {}),
        skills: [
          {
            source: "./skills/git-entry",
            ...(options.loop || options.team ? { entry: true } : {}),
          },
          ...(options.team
            ? [{ source: options.localTeamMember ? "./skills/git-extra" : "./member-workflow" }]
            : []),
          ...(includeExtraSkill ? [{ source: "./skills/git-extra" }] : []),
          ...(options.repoBackedRole
            ? [
                {
                  source: "custom-review",
                  repo: "org/package",
                  installedName: "custom-review-agent",
                },
              ]
            : []),
        ],
        steps: [
          {
            id: "entry",
            title: "Entry",
            skill: "./skills/git-entry",
            ...(options.loop ? { instruction: "Check loop status." } : {}),
          },
          ...(includeExtraSkill
            ? [
                {
                  id: "extra",
                  title: "Extra",
                  skill: "./skills/git-extra",
                },
              ]
            : []),
          ...(options.team
            ? [
                {
                  id: "member",
                  title: "Member",
                  skill: options.localTeamMember ? "./skills/git-extra" : "./member-workflow",
                  ...(options.orchestration ? { phase: "implementation" } : {}),
                },
              ]
            : []),
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

describe("omniskill command module", () => {
  test("setup-model-routing lists models as JSON", async () => {
    const program = new Command();
    const logs: string[] = [];
    const originalLog = console.log;
    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    try {
      configureOmniskillCommand(program, {
        rootDir: "/tmp/project",
        installSkill: async () => {
          throw new Error("not used");
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: testCodexModelCatalog,
      });

      await program.parseAsync(["setup-model-routing", "--list-models", "--json"], {
        from: "user",
      });

      expect(JSON.parse(logs.join("\n"))).toEqual({
        models: [
          {
            slug: "gpt-5.5",
            visibility: "list",
            priority: 0,
            supportedReasoningEfforts: ["low", "medium", "high"],
          },
        ],
      });
      expect(logs.join("\n")).not.toContain("codex-auto-review");
    } finally {
      console.log = originalLog;
    }
  });

  test("setup-model-routing applies the exact confirmed selections", async () => {
    const program = new Command();
    const rootDir = await mkdtemp(join(tmpdir(), "setup-model-routing-command-"));
    const logs: string[] = [];
    const originalLog = console.log;
    let executed = false;
    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    try {
      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("not used");
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: testCodexModelCatalog,
        planModelRoutingSetup: async (input) => {
          expect(input.selections).toEqual({
            planning: { model: "gpt-5.5", reasoningEffort: "high" },
            implementation: { model: "gpt-5.5", reasoningEffort: "medium" },
            verification: { model: "gpt-5.5", reasoningEffort: "high" },
          });
          return {
            config: {
              path: join(rootDir, ".omniskills", "orchestration.json"),
              status: "update",
              config: {
                schemaVersion: "0.2",
                tiers: {
                  deep: {
                    codex: [{ model: "gpt-5.5", reasoningEffort: "high" }],
                    claude: [{ model: "opus", effort: "high" }],
                  },
                  standard: {
                    codex: [{ model: "gpt-5.5", reasoningEffort: "medium" }],
                    claude: [{ model: "sonnet", effort: "medium" }],
                  },
                  fast: {
                    codex: [{ model: "gpt-5.5", reasoningEffort: "low" }],
                    claude: [{ model: "haiku", effort: "low" }],
                  },
                },
                modelRoles: {
                  planning: { codex: [{ model: "gpt-5.5", reasoningEffort: "high" }] },
                  implementation: { codex: [{ model: "gpt-5.5", reasoningEffort: "medium" }] },
                  verification: { codex: [{ model: "gpt-5.5", reasoningEffort: "high" }] },
                },
                limits: {
                  retryPerCandidate: 1,
                  reassignmentPerWorkItem: 1,
                  consultationsPerAgent: 2,
                },
                policy: {
                  sameTierFallback: "automatic_disclosed",
                  lowerTierFallback: "human_approval",
                },
              },
              content: "{}\n",
            },
            profileWrites: [],
            recordWrites: [],
            affectedWorkflows: ["startup-team"],
          };
        },
        executeModelRoutingSetup: async () => {
          executed = true;
        },
      });

      await program.parseAsync(
        [
          "setup-model-routing",
          "--planning-model",
          "gpt-5.5",
          "--planning-effort",
          "high",
          "--implementation-model",
          "gpt-5.5",
          "--implementation-effort",
          "medium",
          "--verification-model",
          "gpt-5.5",
          "--verification-effort",
          "high",
          "--apply",
          "--json",
        ],
        { from: "user" },
      );

      expect(executed).toBe(true);
      expect(JSON.parse(logs.join("\n"))).toMatchObject({
        status: "applied",
        affectedWorkflows: ["startup-team"],
      });
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("registers Omniskills commands and dependency aliases", () => {
    const program = new Command();

    configureOmniskillCommand(program, {
      rootDir: process.cwd(),
      installSkill: async () => {
        throw new Error("install is not exercised by this registration test");
      },
      printSkillInstallResult: () => {},
    });

    expect(program.commands.map((command) => command.name())).toEqual([
      "init",
      "validate",
      "lock",
      "install",
      "list",
      "remove",
      "deps",
      "onboard",
      "setup-model-routing",
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
    expect(
      program.commands
        .find((command) => command.name() === "workflow")
        ?.commands.map((command) => command.name()),
    ).toEqual(["install", "list", "remove"]);
    expect(
      program.commands
        .find((command) => command.name() === "bundle")
        ?.commands.map((command) => command.name()),
    ).toEqual(["init", "validate", "lock"]);
  });

  test("describes bundle commands as supporting workflows and teams", () => {
    const program = new Command();

    configureOmniskillCommand(program, {
      rootDir: process.cwd(),
      installSkill: async () => {
        throw new Error("install is not exercised by command-description tests");
      },
      printSkillInstallResult: () => {},
    });

    const descriptions = new Map(
      program.commands.map((command) => [command.name(), command.description()]),
    );
    expect(descriptions.get("install")).toBe(
      "Install an Omniskills workflow or team and its skills.",
    );
    expect(descriptions.get("list")).toBe("List installed Omniskills workflows and teams.");
    expect(descriptions.get("remove")).toBe(
      "Remove an installed Omniskills workflow or team and its recorded skill artifacts.",
    );
    expect(descriptions.get("deps")).toBe(
      "List the skill dependencies declared by an Omniskills workflow or team.",
    );
  });

  test("install dry-run prints native profiles without installing skills or writing files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-dry-run-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-dry-run-home-"));
    const bundleDir = join(rootDir, "git-team");
    const logs: string[] = [];
    const originalLog = console.log;
    let installCalls = 0;
    let catalogCalls = 0;
    const program = new Command();

    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    try {
      await writeGitWorkflowFixtureAt(bundleDir, {
        team: true,
        orchestration: true,
        repoBackedRole: true,
      });
      await writeFile(
        join(bundleDir, "member-workflow", "skills", "git-extra", "SKILL.md"),
        "---\nname: actual-git-extra\ndescription: Actual member entry skill.\n---\n",
      );
      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async () => {
          installCalls += 1;
          throw new Error("dry-run must not install skills");
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: async () => {
          catalogCalls += 1;
          return [
            {
              slug: "gpt-5.5",
              visibility: "list",
              priority: 0,
              supportedReasoningEfforts: ["low", "medium", "high"],
            },
          ];
        },
      });

      await program.parseAsync(
        ["install", bundleDir, "--home", homeDir, "--agents", "codex,claude", "--dry-run"],
        { from: "user" },
      );

      expect(installCalls).toBe(0);
      expect(catalogCalls).toBe(1);
      expect(logs.join("\n")).toContain("Agent profiles:");
      expect(logs.join("\n")).toContain("omniskills-git-team-git-entry");
      expect(logs.join("\n")).toContain("omniskills-git-team-custom-review");
      expect(logs.join("\n")).toContain("source=./skills/git-entry");
      expect(logs.join("\n")).toContain("taskClass=role");
      expect(logs.join("\n")).toContain("candidate=1/1");
      expect(logs.join("\n")).toContain("model=gpt-5.5");
      expect(logs.join("\n")).toContain("ownership=unowned");
      await expect(
        readFile(join(homeDir, ".omniskills", "orchestration.json"), "utf8"),
      ).rejects.toThrow();
      await expect(
        readFile(join(homeDir, ".omniskills", "workflows", "git-team.json"), "utf8"),
      ).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("stops a Codex orchestration install before writes when model discovery fails", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-catalog-failure-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-catalog-failure-home-"));
    const bundleDir = join(rootDir, "git-team");
    let installCalls = 0;
    const program = new Command();

    try {
      await writeGitWorkflowFixtureAt(bundleDir, {
        team: true,
        orchestration: true,
      });
      await writeFile(
        join(bundleDir, "member-workflow", "skills", "git-extra", "SKILL.md"),
        "---\nname: actual-git-extra\ndescription: Actual member entry skill.\n---\n",
      );
      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        installSkill: async () => {
          installCalls += 1;
          throw new Error("model discovery must run before skill installation");
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: async () => {
          throw new Error("Codex catalog unavailable");
        },
      });

      await expect(
        program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
          from: "user",
        }),
      ).rejects.toThrow("Codex catalog unavailable");
      expect(installCalls).toBe(0);
      await expect(stat(join(homeDir, ".omniskills", "orchestration.json"))).rejects.toThrow();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-team.json")),
      ).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("skips Codex model discovery for a Claude-only orchestration install", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-claude-only-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-claude-only-home-"));
    const bundleDir = join(rootDir, "git-team");
    const logs: string[] = [];
    const originalLog = console.log;
    let catalogCalls = 0;
    const program = new Command();

    try {
      await writeGitWorkflowFixtureAt(bundleDir, {
        team: true,
        orchestration: true,
      });
      await writeFile(
        join(bundleDir, "member-workflow", "skills", "git-extra", "SKILL.md"),
        "---\nname: actual-git-extra\ndescription: Actual member entry skill.\n---\n",
      );
      console.log = (...values: unknown[]) => logs.push(values.join(" "));
      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("dry-run must not install skills");
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: async () => {
          catalogCalls += 1;
          throw new Error("Claude-only install must not discover Codex models");
        },
      });

      await program.parseAsync(
        ["install", bundleDir, "--home", homeDir, "--agents", "claude", "--dry-run"],
        { from: "user" },
      );

      expect(catalogCalls).toBe(0);
      expect(logs.join("\n")).toContain("target=claude");
      expect(logs.join("\n")).toContain("model=opus");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("bootstraps a missing repo-backed role and verifies its installed name", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-repo-role-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-repo-role-home-"));
    const bundleDir = join(rootDir, "git-team");
    const externalInstalls: Array<{ source: string; repo?: string; homeDir: string }> = [];
    const customRoleInstalls: string[] = [];
    const program = new Command();

    try {
      await writeGitWorkflowFixtureAt(bundleDir, {
        team: true,
        orchestration: true,
        repoBackedRole: true,
      });
      await writeFile(
        join(bundleDir, "member-workflow", "skills", "git-extra", "SKILL.md"),
        "---\nname: actual-git-extra\ndescription: Actual member entry skill.\n---\n",
      );
      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        installSkill: async (input) => {
          if (input.source === "custom-review") {
            customRoleInstalls.push(input.source);
            if (customRoleInstalls.length === 1) {
              throw new SkillSourceNotFoundError("Skill source not found: custom-review");
            }
          }
          const skillName = input.source.endsWith("git-extra")
            ? "actual-git-extra"
            : input.source === "custom-review"
              ? "custom-review-agent"
              : "git-entry";
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName,
              destination: join(homeDir, ".agents", "skills", skillName),
            }),
          };
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: testCodexModelCatalog,
        installExternalSkillDependency: async (input) => {
          externalInstalls.push(input);
        },
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      expect(customRoleInstalls).toEqual(["custom-review", "custom-review"]);
      expect(externalInstalls).toEqual([{ source: "custom-review", repo: "org/package", homeDir }]);
      expect(
        await readFile(
          join(homeDir, ".codex", "agents", "omniskills-git-team-custom-review.toml"),
          "utf8",
        ),
      ).toContain("`$custom-review-agent`");
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-team.json")),
      ).resolves.toBeTruthy();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("rejects a repo-backed role when the first installed name mismatches", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-repo-role-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-repo-role-home-"));
    const bundleDir = join(rootDir, "git-team");
    let customRoleInstalls = 0;
    const program = new Command();

    try {
      await writeGitWorkflowFixtureAt(bundleDir, {
        team: true,
        orchestration: true,
        repoBackedRole: true,
      });
      await writeFile(
        join(bundleDir, "member-workflow", "skills", "git-extra", "SKILL.md"),
        "---\nname: actual-git-extra\ndescription: Actual member entry skill.\n---\n",
      );
      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        installSkill: async (input) => {
          if (input.source === "custom-review") {
            customRoleInstalls += 1;
            if (customRoleInstalls === 1) {
              throw new SkillSourceNotFoundError("Skill source not found: custom-review");
            }
          }
          const skillName = input.source.endsWith("git-extra")
            ? "actual-git-extra"
            : input.source === "custom-review"
              ? "wrong-review-agent"
              : "git-entry";
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName,
              destination: join(homeDir, ".agents", "skills", skillName),
            }),
          };
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: testCodexModelCatalog,
        installExternalSkillDependency: async () => {},
      });

      await expect(
        program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
          from: "user",
        }),
      ).rejects.toThrow(
        "Installed skill name mismatch for custom-review: expected custom-review-agent, resolved wrong-review-agent",
      );
      await expect(
        stat(join(homeDir, ".codex", "agents", "omniskills-git-team-custom-review.toml")),
      ).rejects.toThrow();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-team.json")),
      ).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install persists native profiles and their managed artifacts", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-profile-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-profile-home-"));
    const bundleDir = join(rootDir, "git-team");
    const program = new Command();

    try {
      await writeGitWorkflowFixtureAt(bundleDir, {
        team: true,
        orchestration: true,
      });
      await writeFile(
        join(bundleDir, "member-workflow", "skills", "git-extra", "SKILL.md"),
        "---\nname: actual-git-extra\ndescription: Actual member entry skill.\n---\n",
      );
      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        installSkill: async (input) => {
          const skillName = input.source.endsWith("git-extra") ? "actual-git-extra" : "git-entry";
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName,
              destination: join(homeDir, ".agents", "skills", skillName),
            }),
          };
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: testCodexModelCatalog,
      });

      await program.parseAsync(
        ["install", bundleDir, "--home", homeDir, "--agents", "codex,claude"],
        { from: "user" },
      );

      const installed = JSON.parse(
        await readFile(join(homeDir, ".omniskills", "workflows", "git-team.json"), "utf8"),
      );
      expect(installed.installedRoleSkillNames).toEqual({
        "./skills/git-entry": "git-entry",
        "./member-workflow": "actual-git-extra",
      });
      expect(installed.installArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "agent_profile",
            profileId: "omniskills-git-team-git-entry",
            agent: "codex",
          }),
          expect.objectContaining({
            kind: "agent_profile",
            profileId: "omniskills-git-team-git-entry",
            agent: "claude",
          }),
        ]),
      );
      const orchestrationConfig = await readFile(
        join(homeDir, ".omniskills", "orchestration.json"),
        "utf8",
      );
      expect(orchestrationConfig).toContain('"schemaVersion": "0.2"');
      expect(orchestrationConfig).toContain('"modelRoles"');
      await expect(
        readFile(join(homeDir, ".codex", "agents", "omniskills-git-team-git-entry.toml"), "utf8"),
      ).resolves.toContain('model = "gpt-5.5"');
      await expect(
        readFile(join(homeDir, ".claude", "agents", "omniskills-git-team-git-entry.md"), "utf8"),
      ).resolves.toContain("model: opus");
      await expect(
        readFile(
          join(homeDir, ".codex", "agents", "omniskills-git-team-member-workflow.toml"),
          "utf8",
        ),
      ).resolves.toContain("load and follow the installed `$actual-git-extra` skill");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install supports a public git workflow source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-git-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-git-home-"));
    const source = "https://github.com/acme/git-workflow.git";
    const skillInstalls: string[] = [];
    const printedSkills: string[] = [];
    const commands: WorkflowGitCommand[] = [];
    const program = new Command();
    let checkoutDir = "";

    configureOmniskillCommand(program, {
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
      await readFile(join(rootDir, ".omniskills", "workflows", "git-workflow.json"), "utf8"),
    );
    expect(installed.source).toEqual({ kind: "git", url: source, commit: "abc123" });
    await expect(stat(checkoutDir)).rejects.toThrow();

    await rm(rootDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  test("install uses a prepared entry skill source for looped workflows", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-loop-install-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-loop-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const skillInstalls: string[] = [];
    const program = new Command();

    await writeGitWorkflowFixtureAt(bundleDir, { loop: true });

    configureOmniskillCommand(program, {
      rootDir,
      installSkill: async (input) => {
        skillInstalls.push(input.source);
        await expect(readFile(join(input.source, "workflow.json"), "utf8")).resolves.toContain(
          '"loop"',
        );
        const generatedRunner = await readFile(join(input.source, "loop.mjs"), "utf8");
        expect(generatedRunner).toContain("process.env.OMNISKILL_BIN");
        expect(generatedRunner).toContain("omniskill");
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

  test("install resolves a nested repository before target writes", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-nested-repository-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-nested-repository-home-"));
    const parentDir = join(rootDir, "parent");
    const source = "file:///virtual/child.git";
    const events: string[] = [];
    const program = new Command();
    await mkdir(parentDir, { recursive: true });
    await writeFile(
      join(parentDir, "workflow.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        name: "parent",
        version: "1.0.0",
        description: "Parent workflow.",
        skills: [{ source }],
        steps: [{ id: "child", title: "Child", skill: source }],
      }),
    );

    try {
      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        workflowGitCommandRunner: async (command) => {
          events.push(`git:${command.args[0]}`);
          if (command.args[0] === "clone") {
            const checkoutDir = command.args.at(-1) ?? "";
            await mkdir(join(checkoutDir, "skills", "child"), { recursive: true });
            await writeFile(join(checkoutDir, "skills", "child", "SKILL.md"), "# child\n");
            await writeFile(
              join(checkoutDir, "workflow.json"),
              JSON.stringify({
                schemaVersion: "0.1",
                name: "child",
                version: "1.0.0",
                description: "Child workflow.",
                skills: [{ source: "./skills/child" }],
                steps: [{ id: "run", title: "Run", skill: "./skills/child" }],
              }),
            );
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
        installSkill: async (input) => {
          events.push(`install:${input.source}`);
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName: "child",
              destination: join(homeDir, ".agents", "skills", "child"),
            }),
          };
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", parentDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      expect(events.slice(0, 2)).toEqual(["git:clone", "git:rev-parse"]);
      expect(events[2]).toContain("install:");
      expect(events[2]).toContain("skills/child");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install writes the workflow record to the global home by default", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-default-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-default-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const skillInstalls: string[] = [];
    const program = new Command();

    await writeGitWorkflowFixtureAt(bundleDir);

    configureOmniskillCommand(program, {
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
      stat(join(homeDir, ".omniskills", "workflows", "git-workflow.json")),
    ).resolves.toBeTruthy();
    await expect(
      stat(join(rootDir, ".omniskills", "workflows", "git-workflow.json")),
    ).rejects.toThrow();

    await rm(rootDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  test("install force-refreshes only recorded workflow artifacts when workflow version changes", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-version-refresh-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-version-refresh-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const previousSkillPath = join(homeDir, ".agents", "skills", "git-entry");
    const skillInstalls: Array<{
      source: string;
      force: boolean | undefined;
      refreshExisting: boolean | undefined;
    }> = [];
    const program = new Command();

    await writeGitWorkflowFixtureAt(bundleDir, { version: "0.1.1", extraSkill: true });
    await mkdir(join(rootDir, ".omniskills", "workflows"), { recursive: true });
    await writeFile(
      join(rootDir, ".omniskills", "workflows", "git-workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "git-workflow",
          version: "0.1.0",
          description: "Previous install record.",
          skills: [{ source: "./skills/git-entry" }],
          steps: [{ id: "entry", title: "Entry", skill: "./skills/git-entry" }],
          source: { kind: "local", path: bundleDir },
          installArtifacts: [
            {
              source: "./skills/git-entry",
              skillName: "git-entry",
              agent: "codex",
              status: "installed",
              paths: [previousSkillPath],
            },
          ],
        },
        null,
        2,
      ),
    );

    configureOmniskillCommand(program, {
      rootDir,
      installSkill: async (input) => {
        skillInstalls.push({
          source: input.source,
          force: input.force,
          refreshExisting: input.refreshExisting,
        });
        const skillName = input.source.endsWith("git-extra") ? "git-extra" : "git-entry";
        return {
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName,
            destination: join(homeDir, ".agents", "skills", skillName),
          }),
        };
      },
      printSkillInstallResult: () => {},
    });

    await program.parseAsync(
      ["install", bundleDir, "--dir", rootDir, "--home", homeDir, "--agents", "codex"],
      { from: "user" },
    );

    expect(skillInstalls).toEqual([
      {
        source: join(bundleDir, "skills", "git-entry"),
        force: true,
        refreshExisting: false,
      },
      {
        source: join(bundleDir, "skills", "git-extra"),
        force: false,
        refreshExisting: false,
      },
    ]);
    const installed = JSON.parse(
      await readFile(join(rootDir, ".omniskills", "workflows", "git-workflow.json"), "utf8"),
    );
    expect(installed.version).toBe("0.1.1");

    await rm(rootDir, { recursive: true, force: true });
    await rm(homeDir, { recursive: true, force: true });
  });

  test("installs and same-version refreshes Finance Team children from one local checkout", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-team-checkout-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-team-checkout-home-"));
    const examplesDir = join(rootDir, "examples");
    const teamDir = join(examplesDir, "teams", "finance-team");
    const companySource = join(
      examplesDir,
      "workflows",
      "company-analysis",
      "skills",
      "company-analysis",
      "SKILL.md",
    );
    const companyInstalled = join(homeDir, ".agents", "skills", "company-analysis", "SKILL.md");
    const riskCollision = join(homeDir, ".agents", "skills", "risk-analysis", "SKILL.md");
    const program = new Command();
    const installSources: string[] = [];

    try {
      await cp(join(import.meta.dir, "..", "examples"), examplesDir, { recursive: true });
      await mkdir(join(homeDir, ".agents", "skills", "risk-analysis"), { recursive: true });
      await writeFile(riskCollision, "user-owned collision\n");

      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        installSkill: async (input) => {
          installSources.push(input.source);
          return { skillInstall: await installAgentSkill(input) };
        },
        printSkillInstallResult: () => {},
        codexModelCatalog: testCodexModelCatalog,
      });

      await program.parseAsync(["install", teamDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      expect(installSources).toContain(dirname(companySource));
      expect(installSources.every((source) => source.startsWith(rootDir))).toBe(true);
      expect(await readFile(companyInstalled, "utf8")).toBe(await readFile(companySource, "utf8"));
      expect(await readFile(riskCollision, "utf8")).toBe("user-owned collision\n");

      const recordPath = join(homeDir, ".omniskills", "workflows", "finance-team.json");
      const firstRecord = JSON.parse(await readFile(recordPath, "utf8"));
      expect(firstRecord.installedRoleSkillNames["../../workflows/company-analysis"]).toBe(
        "company-analysis",
      );
      expect(firstRecord.installArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            kind: "agent_profile",
            source: "../../workflows/company-analysis",
            instructions: expect.stringContaining("installed `$company-analysis` skill"),
          }),
        ]),
      );

      const legacyRoleSources = new Map(
        Object.entries(firstRecord.installedRoleSkillNames as Record<string, string>)
          .filter(([source]) => source.startsWith("../../workflows/"))
          .map(([source, skillName]) => [source, `catalog:${skillName}`]),
      );
      await writeFile(
        recordPath,
        JSON.stringify(
          {
            ...firstRecord,
            installedRoleSkillNames: undefined,
            installArtifacts: firstRecord.installArtifacts.map(
              (artifact: { kind?: string; source: string; skillName?: string }) => ({
                ...artifact,
                source:
                  legacyRoleSources.get(artifact.source) ??
                  (artifact.kind !== "agent_profile" &&
                  artifact.skillName &&
                  [...legacyRoleSources.values()].includes(`catalog:${artifact.skillName}`)
                    ? join("/legacy-catalog", artifact.skillName, "skills", artifact.skillName)
                    : artifact.source),
              }),
            ),
          },
          null,
          2,
        ),
      );

      await writeFile(
        companySource,
        `${await readFile(companySource, "utf8")}\nSame-version refresh.\n`,
      );
      installSources.length = 0;
      await program.parseAsync(["install", teamDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      expect(installSources).toContain(dirname(companySource));
      expect(await readFile(companyInstalled, "utf8")).toContain("Same-version refresh.");
      expect(await readFile(riskCollision, "utf8")).toBe("user-owned collision\n");
      const upgradedRecord = JSON.parse(await readFile(recordPath, "utf8"));
      expect(upgradedRecord.installedRoleSkillNames["../../workflows/company-analysis"]).toBe(
        "company-analysis",
      );
      expect(upgradedRecord.installArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: dirname(companySource),
            skillName: "company-analysis",
            status: "installed",
          }),
          expect.objectContaining({
            source: join(examplesDir, "workflows", "risk-analysis", "skills", "risk-analysis"),
            skillName: "risk-analysis",
            status: "skipped_exists",
          }),
        ]),
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install persists exact skill artifact paths in the workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-artifacts-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-artifacts-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const program = new Command();
    const primary = join(homeDir, ".agents", "skills", "git-entry");
    const mirror = join(homeDir, ".codex", "skills", "git-entry");

    try {
      await writeGitWorkflowFixtureAt(bundleDir);

      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: primary,
            artifactPaths: [primary, mirror],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      const installed = JSON.parse(
        await readFile(join(homeDir, ".omniskills", "workflows", "git-workflow.json"), "utf8"),
      );

      expect(installed.installArtifacts).toEqual([
        {
          source: "./skills/git-entry",
          skillName: "git-entry",
          agent: "codex",
          status: "installed",
          paths: [primary, mirror],
        },
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("recovers ownership created before a failed install without claiming pre-existing skills", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-install-retry-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-install-retry-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const entryPath = join(homeDir, ".agents", "skills", "git-entry");
    const existingPath = join(homeDir, ".agents", "skills", "git-extra");
    const program = new Command();
    let failExtraOnce = true;
    let entryInstallCount = 0;

    try {
      await writeGitWorkflowFixtureAt(bundleDir, { extraSkill: true });
      await mkdir(existingPath, { recursive: true });
      await writeFile(join(existingPath, "SKILL.md"), "pre-existing skill\n");
      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        installSkill: async (input) => {
          const isExtra = input.source.endsWith("git-extra");
          if (isExtra && failExtraOnce) {
            failExtraOnce = false;
            throw new Error("injected dependency failure");
          }
          const skillName = isExtra ? "git-extra" : "git-entry";
          const destination = join(homeDir, ".agents", "skills", skillName);
          if (!isExtra) {
            entryInstallCount += 1;
            await mkdir(destination, { recursive: true });
            await writeFile(join(destination, "SKILL.md"), "install-owned skill\n");
          }
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName,
              destination,
              status: isExtra || entryInstallCount > 1 ? "already_present" : "installed",
            }),
          };
        },
        printSkillInstallResult: () => {},
      });

      await expect(
        program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
          from: "user",
        }),
      ).rejects.toThrow("injected dependency failure");

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      const installed = JSON.parse(
        await readFile(join(homeDir, ".omniskills", "workflows", "git-workflow.json"), "utf8"),
      );
      expect(installed.installArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillName: "git-entry", status: "installed" }),
          expect.objectContaining({ skillName: "git-extra", status: "already_present" }),
        ]),
      );

      await program.parseAsync(["remove", "git-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });

      await expect(stat(entryPath)).rejects.toThrow();
      await expect(stat(existingPath)).resolves.toBeTruthy();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("records only external-bootstrap targets that a retry reports as updated", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-bootstrap-journal-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-bootstrap-journal-home-"));
    const bundleDir = join(rootDir, "bootstrap-workflow");
    const codexEntryPath = join(homeDir, ".agents", "skills", "tdd");
    const claudeEntryPath = join(homeDir, ".claude", "skills", "tdd");
    const journalPath = join(
      homeDir,
      ".omniskills",
      "workflow-installs",
      "bootstrap-workflow.json",
    );
    const program = new Command();
    let failExtraOnce = true;
    let entryBootstrapped = false;
    let entryAttempts = 0;

    try {
      await mkdir(bundleDir, { recursive: true });
      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "bootstrap-workflow",
            version: "0.1.0",
            description: "Exercises ownership after external bootstrap.",
            skills: [{ source: "mattpocock:tdd" }, { source: "later-dependency" }],
            steps: [
              { id: "tdd", title: "Bootstrap TDD", skill: "mattpocock:tdd" },
              { id: "later", title: "Later dependency", skill: "later-dependency" },
            ],
          },
          null,
          2,
        ),
      );
      await mkdir(claudeEntryPath, { recursive: true });
      await writeFile(join(claudeEntryPath, "SKILL.md"), "pre-existing Claude skill\n");
      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: { confirmInstall: async () => true },
        installSkill: async (input) => {
          if (input.source === "later-dependency" && failExtraOnce) {
            failExtraOnce = false;
            throw new Error("later dependency failure");
          }
          if (input.source === "mattpocock:tdd" && !entryBootstrapped) {
            throw new MissingMattPocockSkillError({ skillName: "tdd", homeDir });
          }
          if (input.source === "mattpocock:tdd") {
            entryAttempts += 1;
            return {
              skillInstall: {
                skillName: "tdd",
                source: { kind: "path", name: "tdd", path: codexEntryPath },
                dryRun: false,
                targets: [
                  {
                    agent: "codex",
                    destination: codexEntryPath,
                    artifactPaths: [codexEntryPath],
                    status: entryAttempts === 1 ? "updated" : "already_present",
                  },
                  {
                    agent: "claude",
                    destination: claudeEntryPath,
                    artifactPaths: [claudeEntryPath],
                    status: "updated",
                  },
                ],
              },
            };
          }
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName: "later-dependency",
              destination: join(homeDir, ".agents", "skills", "later-dependency"),
            }),
          };
        },
        printSkillInstallResult: () => {},
        installExternalSkillDependency: async () => {
          await mkdir(codexEntryPath, { recursive: true });
          await writeFile(join(codexEntryPath, "SKILL.md"), "bootstrap-created\n");
          entryBootstrapped = true;
        },
      });

      await expect(
        program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex,claude"], {
          from: "user",
        }),
      ).rejects.toThrow("later dependency failure");
      await expect(stat(journalPath)).resolves.toBeTruthy();

      await program.parseAsync(
        ["install", bundleDir, "--home", homeDir, "--agents", "codex,claude"],
        { from: "user" },
      );
      const installed = JSON.parse(
        await readFile(
          join(homeDir, ".omniskills", "workflows", "bootstrap-workflow.json"),
          "utf8",
        ),
      );
      expect(installed.installArtifacts).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ skillName: "tdd", agent: "codex", status: "updated" }),
          expect.objectContaining({ skillName: "tdd", agent: "claude", status: "updated" }),
        ]),
      );
      await expect(stat(journalPath)).rejects.toThrow();

      await program.parseAsync(["remove", "bootstrap-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });
      await expect(stat(codexEntryPath)).rejects.toThrow();
      await expect(stat(claudeEntryPath)).resolves.toBeTruthy();
      await expect(stat(journalPath)).rejects.toThrow();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "bootstrap-workflow.json")),
      ).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("list reads workflow records from the global home by default", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-list-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-list-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);

      configureOmniskillCommand(program, {
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

  test("remove dry-run prints the plan without deleting artifacts or workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-remove-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-remove-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["remove", "git-workflow", "--home", homeDir, "--dry-run"], {
        from: "user",
      });

      expect(stripAnsiLines(logs).join("\n")).toContain("Omniskills remove plan: git-workflow");
      expect(stripAnsiLines(logs).join("\n")).toContain("Artifacts that would be removed:");
      await expect(stat(artifactPath)).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-workflow.json")),
      ).resolves.toBeTruthy();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("remove confirmed with yes deletes artifacts and workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-remove-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-remove-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["remove", "git-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });

      expect(stripAnsiLines(logs)).toContain("Omniskills removed: git-workflow");
      await expect(stat(artifactPath)).rejects.toThrow();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-workflow.json")),
      ).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("workflow remove behaves like root remove", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-workflow-remove-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-workflow-remove-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const program = new Command();

    try {
      await writeGitWorkflowFixtureAt(bundleDir);
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });
      await program.parseAsync(["workflow", "remove", "git-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });

      await expect(stat(artifactPath)).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("remove fails clearly when the workflow is not installed", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-remove-missing-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-remove-missing-home-"));
    const program = new Command();

    try {
      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by remove missing");
        },
        printSkillInstallResult: () => {},
      });

      await expect(
        program.parseAsync(["remove", "missing-workflow", "--home", homeDir], { from: "user" }),
      ).rejects.toThrow("Omniskills workflow is not installed: missing-workflow");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("remove keeps artifacts still referenced by another workflow", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-remove-shared-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-remove-shared-home-"));
    const firstBundleDir = join(rootDir, "git-workflow");
    const secondBundleDir = join(rootDir, "ops-workflow");
    const artifactPath = join(homeDir, ".agents", "skills", "git-entry");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(firstBundleDir);
      await writeGitWorkflowFixtureAt(secondBundleDir);
      const secondRecord = JSON.parse(
        await readFile(join(secondBundleDir, "workflow.json"), "utf8"),
      );
      secondRecord.name = "ops-workflow";
      await writeFile(
        join(secondBundleDir, "workflow.json"),
        `${JSON.stringify(secondRecord, null, 2)}\n`,
      );
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");

      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async (input) => ({
          skillInstall: fakeSkillInstallResult({
            source: input.source,
            skillName: "git-entry",
            destination: artifactPath,
            artifactPaths: [artifactPath],
          }),
        }),
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(
        ["install", firstBundleDir, "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await program.parseAsync(
        ["install", secondBundleDir, "--home", homeDir, "--agents", "codex"],
        { from: "user" },
      );
      await program.parseAsync(["remove", "git-workflow", "--home", homeDir, "--yes"], {
        from: "user",
      });

      expect(stripAnsiLines(logs).join("\n")).toContain(
        `${artifactPath} (still used by ops-workflow)`,
      );
      await expect(stat(artifactPath)).resolves.toBeTruthy();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-workflow.json")),
      ).rejects.toThrow();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "ops-workflow.json")),
      ).resolves.toBeTruthy();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install asks for approval with the declared skill list before installing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-approval-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-approval-home-"));
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

      configureOmniskillCommand(program, {
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
      expect(stripAnsiLines(logs)).toContain("Omniskills install cancelled.");
      expect(skillInstalls).toEqual([]);
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-workflow.json")),
      ).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install shows progress and a branded OMNISKILL result when approved", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-progress-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-progress-home-"));
    const bundleDir = join(rootDir, "git-workflow");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir);

      configureOmniskillCommand(program, {
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
      expect(output).toContain("OMNISKILLS");
      expect(output).toContain("Omniskills installed: git-workflow");
      expect(output).toContain(
        `Omniskills file: ${join(homeDir, ".omniskills", "workflows", "git-workflow.json")}`,
      );
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install tells team users to invoke the declared coordinator", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-team-progress-root-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-team-progress-home-"));
    const bundleDir = join(rootDir, "git-team");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await writeGitWorkflowFixtureAt(bundleDir, { team: true });

      configureOmniskillCommand(program, {
        rootDir,
        installPrompt: {
          confirmInstall: async () => true,
        },
        installSkill: async (input) => {
          const skillName = input.source.endsWith("git-extra") ? "git-extra" : "git-entry";
          return {
            skillInstall: fakeSkillInstallResult({
              source: input.source,
              skillName,
              destination: join(homeDir, ".agents", "skills", skillName),
            }),
          };
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["install", bundleDir, "--home", homeDir, "--agents", "codex"], {
        from: "user",
      });

      const output = stripAnsiLines(logs).join("\n");
      expect(output).toContain("Omniskills installed: git-team");
      expect(output).toContain("Next: $git-entry");
      expect(output).not.toContain("$startup-goal");
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-team.json")),
      ).resolves.toBeDefined();
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-member.json")),
      ).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("validate rejects a copied local team member", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-team-validate-"));
    const bundleDir = join(rootDir, "git-team");
    const program = new Command();
    try {
      await writeGitWorkflowFixtureAt(bundleDir, { team: true, localTeamMember: true });
      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("validate must not install skills");
        },
        printSkillInstallResult: () => {},
      });

      await expect(program.parseAsync(["validate", bundleDir], { from: "user" })).rejects.toThrow(
        "Team member must reference a child workflow",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("validate resolves team member workflows", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-team-validate-valid-"));
    const bundleDir = join(rootDir, "git-team");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    try {
      await writeGitWorkflowFixtureAt(bundleDir, { team: true });
      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("validate must not install skills");
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["validate", bundleDir], { from: "user" });

      expect(stripAnsiLines(logs)).toContain("Omniskills valid: git-team@0.1.0");
      expect(stripAnsiLines(logs)).toContain("Skills: 2");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("all graph commands reject invalid team members before target writes", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-team-invalid-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-team-invalid-home-"));
    const bundleDir = join(rootDir, "git-team");
    let installCalls = 0;
    try {
      await writeGitWorkflowFixtureAt(bundleDir, { team: true, localTeamMember: true });
      const commandArgs = [
        ["validate", bundleDir],
        ["deps", bundleDir],
        ["lock", bundleDir],
        ["install", bundleDir, "--home", homeDir, "--agents", "codex"],
      ];

      for (const args of commandArgs) {
        const program = new Command();
        configureOmniskillCommand(program, {
          rootDir,
          installPrompt: { confirmInstall: async () => true },
          installSkill: async () => {
            installCalls += 1;
            throw new Error("installSkill must not run for an invalid graph");
          },
          printSkillInstallResult: () => {},
        });
        await expect(program.parseAsync(args, { from: "user" })).rejects.toThrow(
          "Team member must reference a child workflow",
        );
      }

      expect(installCalls).toBe(0);
      await expect(
        stat(join(homeDir, ".omniskills", "workflows", "git-team.json")),
      ).rejects.toThrow();
      await expect(stat(join(bundleDir, "workflow.lock.json"))).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("install supports a workflow alias source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-alias-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-alias-home-"));
    const source = "openspec-superpowers";
    const canonicalUrl =
      "https://github.com/devos-ing/omni-skills.git#examples/workflows/openspec-superpowers";
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
      configureOmniskillCommand(program, {
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
        "https://github.com/devos-ing/omni-skills.git",
        checkoutDir,
      ]);
      expect(skillInstalls).toEqual([
        join(checkoutDir, "examples", "workflows", "openspec-superpowers", "skills", "git-entry"),
      ]);
      expect(printedSkills).toEqual(["git-entry"]);
      expect(stripAnsiLines(logs)).toContain("Omniskills installed: git-workflow");
      expect(stripAnsiLines(logs).join("\n")).not.toContain(canonicalUrl);
      const installed = JSON.parse(
        await readFile(join(rootDir, ".omniskills", "workflows", "git-workflow.json"), "utf8"),
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
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-git-validate-"));
    const source = "https://github.com/acme/git-workflow.git";
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    let checkoutDir = "";

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureOmniskillCommand(program, {
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
        "Omniskills valid: git-workflow@0.1.0",
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
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-alias-validate-"));
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    let checkoutDir = "";

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureOmniskillCommand(program, {
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
        "Omniskills valid: git-workflow@0.1.0",
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
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-git-deps-"));
    const source = "https://github.com/acme/git-workflow.git";
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    let checkoutDir = "";

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureOmniskillCommand(program, {
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
        "Omniskills dependencies: git-workflow",
        "- ./skills/git-entry",
      ]);
      await expect(stat(checkoutDir)).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("deps expands nested workflows into installable leaf skills", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-nested-deps-"));
    const parentDir = join(rootDir, "parent");
    const childDir = join(parentDir, "child");
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    const writeBundle = async (bundleDir: string, name: string, extraSource?: string) => {
      await mkdir(join(bundleDir, "skills", name), { recursive: true });
      await writeFile(join(bundleDir, "skills", name, "SKILL.md"), `# ${name}\n`);
      const sources = [`./skills/${name}`, ...(extraSource ? [extraSource] : [])];
      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name,
            version: "1.0.0",
            description: `${name} workflow.`,
            skills: sources.map((source) => ({ source })),
            steps: sources.map((source, index) => ({
              id: `step-${index}`,
              title: `Step ${index}`,
              skill: source,
            })),
          },
          null,
          2,
        ),
      );
    };

    console.log = (...values: unknown[]) => logs.push(values.join(" "));
    try {
      await writeBundle(parentDir, "parent", "./child");
      await writeBundle(childDir, "child", "shared-review");
      configureOmniskillCommand(program, {
        rootDir,
        installSkill: async () => {
          throw new Error("install is not exercised by this deps test");
        },
        printSkillInstallResult: () => {},
      });

      await program.parseAsync(["deps", parentDir], { from: "user" });

      expect(stripAnsiLines(logs)).toEqual([
        "Omniskills dependencies: parent",
        `- ${join(parentDir, "skills", "parent")}`,
        `- ${join(childDir, "skills", "child")}`,
        "- shared-review",
      ]);
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("deps supports a workflow alias source", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-alias-deps-"));
    const logs: string[] = [];
    const originalLog = console.log;
    const program = new Command();
    let checkoutDir = "";

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureOmniskillCommand(program, {
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
        "Omniskills dependencies: git-workflow",
        "- ./skills/git-entry",
      ]);
      await expect(stat(checkoutDir)).rejects.toThrow();
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard skips RTK and CodeGraph setup when declined", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-onboard-"));
    const logs: string[] = [];
    const prompts: string[] = [];
    const commands: OmniskillOnboardCommand[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureOmniskillCommand(program, {
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
      expect(stripAnsiLines(logs)).toContain("Omniskills onboard");
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
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-onboard-"));
    const logs: string[] = [];
    const promptAnswers = [true, false];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureOmniskillCommand(program, {
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
      expect(stripAnsiLines(logs)).toContain("Omniskills onboard complete");
      expect(stripAnsiLines(logs)).toContain("CodeGraph setup skipped");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard fails clearly when the target directory is missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-onboard-"));
    const program = new Command();

    try {
      configureOmniskillCommand(program, {
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
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-onboard-"));
    const logs: string[] = [];
    const prompts: string[] = [];
    const commands: OmniskillOnboardCommand[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      await mkdir(join(rootDir, ".codegraph"), { recursive: true });
      configureOmniskillCommand(program, {
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
      expect(stripAnsiLines(logs)).toContain("Omniskills onboard");
      expect(stripAnsiLines(logs)).toContain(`Workspace: ${rootDir}`);
      expect(stripAnsiLines(logs)).toContain("RTK ready");
      expect(stripAnsiLines(logs)).toContain("CodeGraph ready");
      expect(stripAnsiLines(logs)).toContain("Omniskills onboard complete");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard runs CodeGraph indexing when confirmed", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-onboard-"));
    const logs: string[] = [];
    const prompts: string[] = [];
    const promptAnswers = [false, true];
    const commands: OmniskillOnboardCommand[] = [];
    const originalLog = console.log;
    const program = new Command();

    console.log = (...values: unknown[]) => {
      logs.push(values.join(" "));
    };

    try {
      configureOmniskillCommand(program, {
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
      expect(stripAnsiLines(logs)).toContain("Omniskills onboard complete");
    } finally {
      console.log = originalLog;
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("onboard reports CodeGraph setup failures with command detail", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-onboard-"));
    const promptAnswers = [false, true];
    const program = new Command();

    try {
      configureOmniskillCommand(program, {
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
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
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
          skills: [{ source: "mattpocock:tdd", repo: mattPocockV1_1Repo }],
          steps: [{ id: "tdd", title: "Implement with TDD", skill: "mattpocock:tdd" }],
        },
        null,
        2,
      ),
    );

    configureOmniskillCommand(program, {
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
      { source: "mattpocock:tdd", repo: mattPocockV1_1Repo, homeDir },
    ]);
    expect(printedSkills).toEqual(["tdd"]);
    await expect(
      stat(join(rootDir, ".omniskills", "workflows", "matt-bundle.json")),
    ).resolves.toBeTruthy();
  });

  test("uses the skills CLI before retrying each missing Superpowers workflow skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
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

    configureOmniskillCommand(program, {
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
      stat(join(rootDir, ".omniskills", "workflows", "superpowers-bundle.json")),
    ).resolves.toBeTruthy();
  });

  test("explains when the skills CLI ran but the dependency is still missing", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "omniskill-"));
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
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
          skills: [{ source: "mattpocock:tdd", repo: mattPocockV1_1Repo }],
          steps: [{ id: "tdd", title: "Implement with TDD", skill: "mattpocock:tdd" }],
        },
        null,
        2,
      ),
    );

    configureOmniskillCommand(program, {
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
      `The skills CLI ran for ${mattPocockV1_1Repo}, but mattpocock:tdd is still missing.`,
    );
    expect(externalInstalls).toEqual([
      { source: "mattpocock:tdd", repo: mattPocockV1_1Repo, homeDir },
    ]);
  });

  test("installs the declared skills CLI repo non-interactively before adding external dependencies", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
    const commands: OmniskillExternalSkillCommand[] = [];

    await installExternalSkillDependencyWithSkillsCli({
      source: "mattpocock:tdd",
      repo: mattPocockV1_1Repo,
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
          mattPocockV1_1Repo,
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
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
    const commands: OmniskillExternalSkillCommand[] = [];

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

  test("installs upstream canonical and interface craft compatibility sources", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
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

    for (const [canonical, legacy, installedName] of mappings) {
      for (const source of [canonical, legacy]) {
        const commands: OmniskillExternalSkillCommand[] = [];
        await installExternalSkillDependencyWithSkillsCli({
          source,
          repo: "emilkowalski/skills",
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
          "emilkowalski/skills",
          "--yes",
          "--global",
          "--skill",
          installedName,
          "--agent",
          "codex",
        ]);
      }
    }
  });

  test("installs a bare skills CLI package source non-interactively", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
    const commands: OmniskillExternalSkillCommand[] = [];

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
    const homeDir = await mkdtemp(join(tmpdir(), "omniskill-home-"));
    const commands: OmniskillExternalSkillCommand[] = [];

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
