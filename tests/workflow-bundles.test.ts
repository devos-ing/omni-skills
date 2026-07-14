import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import {
  createWorkflowBundleScaffold,
  createWorkflowLockFile,
  createWorkflowLoopMetadata,
  createWorkflowRemovalPlan,
  executeWorkflowRemovalPlan,
  getPreparedWorkflowSkillInstallDependencies,
  getWorkflowInvocationSkillName,
  getWorkflowSkillInstallDependencies,
  getWorkflowSkillInstallSources,
  installWorkflowBundle,
  listInstalledWorkflowBundles,
  loadWorkflowBundle,
  loadWorkflowLockFile,
  resolveWorkflowDependencyGraph,
  WorkflowBundleManifestSchema,
  type WorkflowGitCommand,
  type WorkflowInstallSkillArtifact,
  WorkflowLockFileSchema,
  workflowLockFileName,
  writeWorkflowLockFile,
} from "../src/runtimes/omniskill/workflow-bundles";

const startupRoleContracts = [
  { role: "ceo", phrases: ["company-level decision", "smallest evidence-gathering step"] },
  { role: "product-manager", phrases: ["Write acceptance criteria", "visible product progress"] },
  { role: "cto", phrases: ["technical trajectory", "verification gate"] },
  {
    role: "engineering-manager",
    phrases: ["smallest shippable outcome", "verifiable state"],
  },
  {
    role: "founding-engineer",
    phrases: ["smallest correct change", "smallest useful verification loop"],
  },
  { role: "qa-lead", phrases: ["Restate the user-facing behavior", "Separate verified facts"] },
  {
    role: "web-design",
    phrases: [
      "Review all changed animation with `interface-craft:motion-review`",
      "Before | After | Why",
      "**Approve** or **Block**",
    ],
  },
] as const;

const readStartupRoleSkill = (role: string) =>
  readFile(
    join(import.meta.dir, "..", "examples", "workflows", role, "skills", role, "SKILL.md"),
    "utf8",
  );

const validTeamManifest = {
  schemaVersion: "0.1",
  kind: "team",
  name: "test-team",
  version: "0.1.0",
  description: "A test team with one coordinator and one member.",
  coordinator: "./skills/coordinator",
  members: ["catalog:member-workflow"],
  skills: [
    { source: "./skills/coordinator", entry: true },
    { source: "catalog:member-workflow" },
    { source: "external-review" },
  ],
  steps: [
    { id: "route", title: "Route work", skill: "./skills/coordinator" },
    { id: "review", title: "Review work", skill: "catalog:member-workflow" },
  ],
} as const;

async function writeTeamBundleFixtureAt(bundleDir: string, kind: "team" | "workflow" = "team") {
  await mkdir(join(bundleDir, "skills", "coordinator"), { recursive: true });
  await mkdir(join(bundleDir, "skills", "member"), { recursive: true });
  await writeFile(
    join(bundleDir, "skills", "coordinator", "SKILL.md"),
    '---\nname: coordinator\ndescription: "Coordinate the team."\n---\n',
  );
  await writeFile(
    join(bundleDir, "skills", "member", "SKILL.md"),
    '---\nname: member\ndescription: "Act as a team member."\n---\n',
  );
  await writeFile(
    join(bundleDir, "workflow.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1",
        kind,
        name: "fixture-team",
        version: "0.1.0",
        description: "Team alias fixture.",
        ...(kind === "team"
          ? { coordinator: "./skills/coordinator", members: ["./skills/member"] }
          : {}),
        skills: [{ source: "./skills/coordinator", entry: true }, { source: "./skills/member" }],
        steps: [{ id: "route", title: "Route", skill: "./skills/coordinator" }],
      },
      null,
      2,
    )}\n`,
  );
}

async function writeTeamWithMemberFixture(input: {
  rootDir: string;
  memberSource: string;
  childSkills?: Array<{ source: string; entry?: boolean }>;
}): Promise<{ teamDir: string; childDir: string }> {
  const teamDir = join(input.rootDir, "team");
  const childDir = join(input.rootDir, "child");
  const childSkills = input.childSkills ?? [{ source: "./skills/member", entry: true }];
  await mkdir(join(teamDir, "skills", "coordinator"), { recursive: true });
  await mkdir(childDir, { recursive: true });
  await writeFile(join(teamDir, "skills", "coordinator", "SKILL.md"), "# coordinator\n");
  for (const skill of childSkills) {
    if (skill.source.startsWith("./skills/")) {
      await mkdir(join(childDir, skill.source), { recursive: true });
      await writeFile(join(childDir, skill.source, "SKILL.md"), `# ${skill.source}\n`);
    }
  }
  await writeFile(
    join(childDir, "workflow.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      name: "member-workflow",
      version: "1.0.0",
      description: "Canonical member workflow.",
      skills: childSkills,
      steps: [{ id: "member", title: "Member", skill: childSkills[0]?.source }],
    }),
  );
  await writeFile(
    join(teamDir, "workflow.json"),
    JSON.stringify({
      schemaVersion: "0.1",
      kind: "team",
      name: "test-team",
      version: "1.0.0",
      description: "Team with one canonical member workflow.",
      coordinator: "./skills/coordinator",
      members: [input.memberSource],
      skills: [{ source: "./skills/coordinator", entry: true }, { source: input.memberSource }],
      steps: [
        { id: "coordinate", title: "Coordinate", skill: "./skills/coordinator" },
        { id: "member", title: "Member", skill: input.memberSource },
      ],
    }),
  );
  return { teamDir, childDir };
}

describe("workflow bundles", () => {
  test("exports workflow bundle helpers from the Omniskills runtime namespace", async () => {
    const runtime = await import("../src/runtimes/omniskill/workflow-bundles");

    expect(typeof runtime.loadWorkflowBundle).toBe("function");
    expect(typeof runtime.getPreparedWorkflowSkillInstallDependencies).toBe("function");
  });

  test("rejects a copied local skill as a team member", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "team-local-member-"));
    try {
      const { teamDir } = await writeTeamWithMemberFixture({
        rootDir,
        memberSource: "./skills/copied-member",
      });
      await mkdir(join(teamDir, "skills", "copied-member"), { recursive: true });
      await writeFile(join(teamDir, "skills", "copied-member", "SKILL.md"), "# copied\n");

      await expect(
        resolveWorkflowDependencyGraph({ bundle: await loadWorkflowBundle(teamDir) }),
      ).rejects.toThrow(
        "Team member must reference a child workflow with exactly one local entry skill: ./skills/copied-member",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("resolves a team member to one canonical child workflow entry skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "team-member-workflow-"));
    try {
      const { teamDir } = await writeTeamWithMemberFixture({
        rootDir,
        memberSource: "../child",
      });
      const graph = await resolveWorkflowDependencyGraph({
        bundle: await loadWorkflowBundle(teamDir),
      });

      expect(graph.workflows.map(({ name }) => name)).toEqual(["test-team", "member-workflow"]);
      expect(graph.edges).toEqual([
        { from: "workflow:test-team@1.0.0", to: "workflow:member-workflow@1.0.0" },
      ]);
      expect(graph.dependencies.map(({ source }) => source)).toEqual([
        join(teamDir, "skills", "coordinator"),
        join(rootDir, "child", "skills", "member"),
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("validates resolved members inside nested team workflows", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "nested-team-members-"));
    const outerDir = join(rootDir, "outer");
    try {
      const { teamDir } = await writeTeamWithMemberFixture({
        rootDir,
        memberSource: "./skills/copied-member",
      });
      await mkdir(join(teamDir, "skills", "copied-member"), { recursive: true });
      await writeFile(join(teamDir, "skills", "copied-member", "SKILL.md"), "# copied\n");
      await mkdir(outerDir, { recursive: true });
      await writeFile(
        join(outerDir, "workflow.json"),
        JSON.stringify({
          schemaVersion: "0.1",
          name: "outer-workflow",
          version: "1.0.0",
          description: "Workflow containing a nested team.",
          skills: [{ source: "../team" }],
          steps: [{ id: "team", title: "Team", skill: "../team" }],
        }),
      );

      await expect(
        resolveWorkflowDependencyGraph({ bundle: await loadWorkflowBundle(outerDir) }),
      ).rejects.toThrow(
        "Team member must reference a child workflow with exactly one local entry skill: ./skills/copied-member",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects team member workflows without one local entry skill", async () => {
    const cases = [
      {
        label: "zero entries",
        childSkills: [{ source: "./skills/member" }],
        message:
          "Team member must reference a child workflow with exactly one local entry skill: ../child",
      },
      {
        label: "non-local entry",
        childSkills: [{ source: "external-member", entry: true }],
        message:
          "Team member must reference a child workflow with exactly one local entry skill: ../child",
      },
      {
        label: "multiple entries",
        childSkills: [
          { source: "./skills/member", entry: true },
          { source: "./skills/other", entry: true },
        ],
        message:
          /Failed to resolve team member \.\.\/child:[\s\S]*Only one workflow skill can be marked as entry/,
      },
    ] as const;

    for (const testCase of cases) {
      const rootDir = await mkdtemp(join(tmpdir(), `team-member-${testCase.label}-`));
      try {
        const { teamDir } = await writeTeamWithMemberFixture({
          rootDir,
          memberSource: "../child",
          childSkills: [...testCase.childSkills],
        });
        await expect(
          resolveWorkflowDependencyGraph({ bundle: await loadWorkflowBundle(teamDir) }),
        ).rejects.toThrow(testCase.message);
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    }
  });

  test("rejects duplicate resolved team workflows and entry skill names", async () => {
    const cases = [
      {
        label: "workflow",
        firstName: "shared-member",
        secondName: "shared-member",
        firstEntry: "first-entry",
        secondEntry: "second-entry",
        message: "Duplicate resolved team workflow: shared-member",
      },
      {
        label: "entry",
        firstName: "first-member",
        secondName: "second-member",
        firstEntry: "shared-entry",
        secondEntry: "shared-entry",
        message: "Duplicate resolved team entry skill: shared-entry",
      },
    ] as const;

    for (const testCase of cases) {
      const rootDir = await mkdtemp(join(tmpdir(), `team-duplicate-${testCase.label}-`));
      const teamDir = join(rootDir, "team");
      const writeChild = async (directory: string, name: string, entryName: string) => {
        await mkdir(join(directory, "skills", entryName), { recursive: true });
        await writeFile(join(directory, "skills", entryName, "SKILL.md"), `# ${entryName}\n`);
        await writeFile(
          join(directory, "workflow.json"),
          JSON.stringify({
            schemaVersion: "0.1",
            name,
            version: "1.0.0",
            description: `${name} workflow.`,
            skills: [{ source: `./skills/${entryName}`, entry: true }],
            steps: [{ id: "run", title: "Run", skill: `./skills/${entryName}` }],
          }),
        );
      };

      try {
        await mkdir(join(teamDir, "skills", "coordinator"), { recursive: true });
        await writeFile(join(teamDir, "skills", "coordinator", "SKILL.md"), "# coordinator\n");
        await writeChild(join(rootDir, "first"), testCase.firstName, testCase.firstEntry);
        await writeChild(join(rootDir, "second"), testCase.secondName, testCase.secondEntry);
        await writeFile(
          join(teamDir, "workflow.json"),
          JSON.stringify({
            schemaVersion: "0.1",
            kind: "team",
            name: "duplicate-team",
            version: "1.0.0",
            description: "Team with duplicate resolved member identities.",
            coordinator: "./skills/coordinator",
            members: ["../first", "../second"],
            skills: [
              { source: "./skills/coordinator", entry: true },
              { source: "../first" },
              { source: "../second" },
            ],
            steps: [
              { id: "first", title: "First", skill: "../first" },
              { id: "second", title: "Second", skill: "../second" },
            ],
          }),
        );

        await expect(
          resolveWorkflowDependencyGraph({ bundle: await loadWorkflowBundle(teamDir) }),
        ).rejects.toThrow(testCase.message);
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    }
  });

  test("identifies the team member source when its workflow graph cycles", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "team-member-cycle-"));
    try {
      const { teamDir, childDir } = await writeTeamWithMemberFixture({
        rootDir,
        memberSource: "../child",
      });
      await writeFile(
        join(childDir, "workflow.json"),
        JSON.stringify({
          schemaVersion: "0.1",
          name: "member-workflow",
          version: "1.0.0",
          description: "Member workflow that cycles to its team.",
          skills: [{ source: "./skills/member", entry: true }, { source: "../team" }],
          steps: [{ id: "member", title: "Member", skill: "./skills/member" }],
        }),
      );

      await expect(
        resolveWorkflowDependencyGraph({ bundle: await loadWorkflowBundle(teamDir) }),
      ).rejects.toThrow(
        "Failed to resolve team member ../child: Workflow dependency cycle: workflow:test-team@1.0.0 -> workflow:member-workflow@1.0.0 -> workflow:test-team@1.0.0",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects bare sources that are not valid workflow aliases", async () => {
    await expect(loadWorkflowBundle("ProductDev")).rejects.toThrow(
      "Unsupported Omniskills source: ProductDev",
    );
    await expect(loadWorkflowBundle("product_dev")).rejects.toThrow(
      "Unsupported Omniskills source: product_dev",
    );
  });

  test("validates a transitive lock with transport-independent root identity", async () => {
    const repositoryUrl = pathToFileURL(join(import.meta.dir, "..")).toString();
    const bundle = await loadWorkflowBundle(`${repositoryUrl}#examples/workflows/skill-tree-demo`);

    try {
      const graph = await resolveWorkflowDependencyGraph({ bundle });
      expect(graph.workflows.map((workflow) => workflow.name)).toEqual(["skill-tree-demo", "cto"]);
    } finally {
      await bundle.cleanup?.();
    }
  });

  test("rejects a tampered root source in a transitive lock", async () => {
    const bundle = await loadWorkflowBundle(
      join(import.meta.dir, "..", "examples", "workflows", "skill-tree-demo"),
    );
    const lock = bundle.lock;
    if (lock?.schemaVersion !== "0.2") {
      throw new Error("Expected the skill-tree demo to have a transitive lock");
    }
    const rootWorkflow = lock.workflows[0];
    if (!rootWorkflow) {
      throw new Error("Expected the transitive lock to have a root workflow");
    }
    bundle.lock = {
      ...lock,
      workflows: [
        { ...rootWorkflow, source: { kind: "local", path: "./tampered-root" } },
        ...lock.workflows.slice(1),
      ],
    };

    await expect(resolveWorkflowDependencyGraph({ bundle })).rejects.toThrow(
      "Transitive workflow lock has an invalid root source",
    );
  });

  test("selects the highest leaf repository semver for one logical skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-leaf-version-"));
    await writeFile(
      join(rootDir, "workflow.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        name: "leaf-version",
        version: "1.0.0",
        description: "Leaf version selection.",
        skills: [
          { source: "shared", repo: "org/pkg@1.0.0" },
          { source: "shared", repo: "org/pkg@2.0.0" },
        ],
        steps: [{ id: "run", title: "Run", skill: "shared" }],
      }),
    );

    try {
      const graph = await resolveWorkflowDependencyGraph({
        bundle: await loadWorkflowBundle(rootDir),
      });
      expect(graph.dependencies).toEqual([{ source: "shared", repo: "org/pkg@2.0.0" }]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("selects a versioned leaf over an unversioned default in either mixed leaf order", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-mixed-leaf-version-"));

    try {
      for (const [index, repos] of [
        ["org/pkg@2.0.0", "org/pkg"],
        ["org/pkg", "org/pkg@2.0.0"],
      ].entries()) {
        const bundleDir = join(rootDir, String(index));
        await mkdir(bundleDir, { recursive: true });
        await writeFile(
          join(bundleDir, "workflow.json"),
          JSON.stringify({
            schemaVersion: "0.1",
            name: `mixed-leaf-version-${index}`,
            version: "1.0.0",
            description: "Mixed leaf version selection.",
            skills: repos.map((repo) => ({ source: "shared", repo })),
            steps: [{ id: "run", title: "Run", skill: "shared" }],
          }),
        );

        const graph = await resolveWorkflowDependencyGraph({
          bundle: await loadWorkflowBundle(bundleDir),
        });
        expect(graph.dependencies).toEqual([{ source: "shared", repo: "org/pkg@2.0.0" }]);
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("deduplicates a legacy bare alias when a pinned canonical dependency is available", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-legacy-alias-"));
    const childDir = join(rootDir, "child");
    await mkdir(childDir, { recursive: true });
    await writeFile(
      join(childDir, "workflow.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        name: "legacy-child",
        version: "1.0.0",
        description: "Legacy child dependency.",
        skills: [{ source: "implement" }],
        steps: [{ id: "run", title: "Run", skill: "implement" }],
      }),
    );
    await writeFile(
      join(rootDir, "workflow.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        name: "canonical-parent",
        version: "1.0.0",
        description: "Canonical parent dependency.",
        skills: [
          { source: "./child" },
          {
            source: "mattpocock:implement",
            repo: "https://github.com/mattpocock/skills/tree/v1.1.0",
          },
        ],
        steps: [{ id: "run", title: "Run", skill: "mattpocock:implement" }],
      }),
    );

    try {
      const graph = await resolveWorkflowDependencyGraph({
        bundle: await loadWorkflowBundle(rootDir),
      });
      expect(graph.dependencies).toEqual([
        {
          source: "mattpocock:implement",
          repo: "https://github.com/mattpocock/skills/tree/v1.1.0",
        },
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid manifest semantic versions during schema parsing", () => {
    expect(() =>
      WorkflowBundleManifestSchema.parse({
        schemaVersion: "0.1",
        name: "invalid-version",
        version: "not-semver",
        description: "Invalid version.",
        skills: [{ source: "leaf" }],
        steps: [{ id: "run", title: "Run", skill: "leaf" }],
      }),
    ).toThrow("Invalid workflow semantic version: not-semver");
  });

  test("creates a transitive lock while expanding three local workflow levels", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-dependency-tree-"));
    const parentDir = join(rootDir, "parent");
    const childDir = join(parentDir, "child");
    const grandchildDir = join(childDir, "grandchild");

    const writeBundle = async (
      bundleDir: string,
      name: string,
      skills: Array<{ source: string; repo?: string }>,
    ) => {
      await mkdir(join(bundleDir, "skills", name), { recursive: true });
      await writeFile(join(bundleDir, "skills", name, "SKILL.md"), `# ${name}\n`);
      const directSkills = [{ source: `./skills/${name}` }, ...skills];
      await writeFile(
        join(bundleDir, "workflow.json"),
        `${JSON.stringify(
          {
            schemaVersion: "0.1",
            name,
            version: "1.0.0",
            description: `${name} workflow.`,
            skills: directSkills,
            steps: directSkills.map((skill, index) => ({
              id: `step-${index}`,
              title: `Step ${index}`,
              skill: skill.source,
            })),
          },
          null,
          2,
        )}\n`,
      );
    };

    await writeBundle(parentDir, "parent", [
      { source: "./child" },
      { source: "shared-review", repo: "example/shared@1.0.0" },
    ]);
    await writeBundle(childDir, "child", [
      { source: "./grandchild" },
      { source: "shared-review", repo: "example/shared@1.0.0" },
    ]);
    await writeBundle(grandchildDir, "grandchild", [
      { source: "shared-review", repo: "example/shared@1.0.0" },
    ]);

    try {
      const bundle = await loadWorkflowBundle(parentDir);
      const graph = await resolveWorkflowDependencyGraph({ bundle });

      expect(graph.dependencies).toEqual([
        { source: join(parentDir, "skills", "parent") },
        { source: join(childDir, "skills", "child") },
        { source: join(grandchildDir, "skills", "grandchild") },
        { source: "shared-review", repo: "example/shared@1.0.0" },
      ]);
      expect(graph.workflows.map((workflow) => workflow.name)).toEqual([
        "parent",
        "child",
        "grandchild",
      ]);
      expect(graph.edges).toEqual([
        { from: "workflow:parent@1.0.0", to: "workflow:child@1.0.0" },
        { from: "workflow:child@1.0.0", to: "workflow:grandchild@1.0.0" },
      ]);
      const lock = await createWorkflowLockFile(bundle, {
        generatedAt: "2026-07-14T00:00:00.000Z",
      });
      expect(lock.schemaVersion).toBe("0.2");
      if (lock.schemaVersion !== "0.2") {
        throw new Error("Expected a transitive workflow lock");
      }
      expect(lock.workflows.map(({ name, version }) => `${name}@${version}`)).toEqual([
        "parent@1.0.0",
        "child@1.0.0",
        "grandchild@1.0.0",
      ]);
      expect(lock.edges).toEqual(graph.edges);
      expect(lock.skills.map((skill) => skill.source)).toEqual([
        "./skills/parent",
        "./child/skills/child",
        "./child/grandchild/skills/grandchild",
        "shared-review",
      ]);
      await graph.cleanup?.();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects recursive workflow cycles with the full active path", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-dependency-cycle-"));
    const firstDir = join(rootDir, "first");
    const secondDir = join(firstDir, "second");
    await mkdir(firstDir, { recursive: true });
    await mkdir(secondDir, { recursive: true });
    const manifest = (name: string, source: string) => ({
      schemaVersion: "0.1",
      name,
      version: "1.0.0",
      description: `${name} workflow.`,
      skills: [{ source }],
      steps: [{ id: "run", title: "Run", skill: source }],
    });
    await writeFile(
      join(firstDir, "workflow.json"),
      JSON.stringify(manifest("first", "./second"), null, 2),
    );
    await writeFile(
      join(secondDir, "workflow.json"),
      JSON.stringify(manifest("second", ".."), null, 2),
    );

    try {
      const bundle = await loadWorkflowBundle(firstDir);
      await expect(resolveWorkflowDependencyGraph({ bundle })).rejects.toThrow(
        "Workflow dependency cycle: workflow:first@1.0.0 -> workflow:second@1.0.0 -> workflow:first@1.0.0",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("selects the highest child workflow semver for a team member", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-dependency-version-"));
    const parentDir = join(rootDir, "parent");
    const lowDir = join(parentDir, "low");
    const highDir = join(parentDir, "high");
    const writeMemberManifest = async (bundleDir: string, version: string, entryName: string) => {
      await mkdir(join(bundleDir, "skills", entryName), { recursive: true });
      await writeFile(join(bundleDir, "skills", entryName, "SKILL.md"), `# ${entryName}\n`);
      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "shared-child",
            version,
            description: "Shared child workflow.",
            skills: [{ source: `./skills/${entryName}`, entry: true }],
            steps: [{ id: "run", title: "Run", skill: `./skills/${entryName}` }],
          },
          null,
          2,
        ),
      );
    };
    await mkdir(join(parentDir, "skills", "coordinator"), { recursive: true });
    await writeFile(join(parentDir, "skills", "coordinator", "SKILL.md"), "# coordinator\n");
    await writeFile(
      join(parentDir, "workflow.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        kind: "team",
        name: "parent",
        version: "1.0.0",
        description: "Team whose member has competing versions.",
        coordinator: "./skills/coordinator",
        members: ["./low"],
        skills: [
          { source: "./skills/coordinator", entry: true },
          { source: "./low" },
          { source: "./high" },
        ],
        steps: [{ id: "member", title: "Member", skill: "./low" }],
      }),
    );
    await writeMemberManifest(lowDir, "1.2.0", "low-only-skill");
    await writeMemberManifest(highDir, "1.10.0", "high-only-skill");

    try {
      const graph = await resolveWorkflowDependencyGraph({
        bundle: await loadWorkflowBundle(parentDir),
      });

      expect(graph.workflows.map(({ name, version }) => `${name}@${version}`)).toEqual([
        "parent@1.0.0",
        "shared-child@1.10.0",
      ]);
      expect(graph.dependencies.map(({ source }) => source)).toEqual([
        join(parentDir, "skills", "coordinator"),
        join(highDir, "skills", "high-only-skill"),
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("expands a repository child workflow from a subdirectory and records its commit", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-repository-child-"));
    const parentDir = join(rootDir, "parent");
    const source = "https://github.com/acme/workflows.git#packages/child";
    const commands: WorkflowGitCommand[] = [];
    await mkdir(join(parentDir, "skills", "coordinator"), { recursive: true });
    await writeFile(join(parentDir, "skills", "coordinator", "SKILL.md"), "# coordinator\n");
    await writeFile(
      join(parentDir, "workflow.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        kind: "team",
        name: "parent",
        version: "1.0.0",
        description: "Parent team.",
        coordinator: "./skills/coordinator",
        members: [source],
        skills: [{ source: "./skills/coordinator", entry: true }, { source }],
        steps: [{ id: "child", title: "Child", skill: source }],
      }),
    );

    try {
      const lock = await createWorkflowLockFile(await loadWorkflowBundle(parentDir), {
        generatedAt: "2026-07-14T00:00:00.000Z",
        runGitCommand: async (command) => {
          commands.push(command);
          if (command.args[0] === "clone") {
            const checkoutDir = command.args.at(-1) ?? "";
            const childDir = join(checkoutDir, "packages", "child");
            await mkdir(join(childDir, "skills", "child"), { recursive: true });
            await writeFile(join(childDir, "skills", "child", "SKILL.md"), "# child\n");
            await writeFile(
              join(childDir, "workflow.json"),
              JSON.stringify({
                schemaVersion: "0.1",
                name: "child",
                version: "2.0.0",
                description: "Repository child.",
                skills: [{ source: "./skills/child", entry: true }],
                steps: [{ id: "run", title: "Run", skill: "./skills/child" }],
              }),
            );
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
      });

      expect(commands.map((command) => command.args[0])).toEqual(["clone", "rev-parse"]);
      expect(lock.schemaVersion).toBe("0.2");
      if (lock.schemaVersion !== "0.2") {
        throw new Error("Expected a transitive lock");
      }
      expect(lock.workflows[1]).toMatchObject({
        name: "child",
        version: "2.0.0",
        source: { kind: "git", url: source, commit: "abc123", subdirectory: "packages/child" },
      });
      expect(lock.skills).toHaveLength(2);
      expect(lock.skills[0]?.source).toBe("./skills/coordinator");
      expect(lock.skills[1]?.source).toBe("workflow:child@2.0.0#./skills/child");
      expect(lock.skills[1]?.resolvedName).toBe("child");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("expands catalog and installed child workflow sources", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-source-adapters-"));
    const catalogParentDir = join(rootDir, "catalog-parent");
    const installedParentDir = join(rootDir, "installed-parent");
    const installedChildDir = join(rootDir, "installed-child");
    const writeManifest = async (
      bundleDir: string,
      name: string,
      version: string,
      source: string,
      options: { team?: boolean; entry?: boolean } = {},
    ) => {
      await mkdir(bundleDir, { recursive: true });
      if (options.team) {
        await mkdir(join(bundleDir, "skills", "coordinator"), { recursive: true });
        await writeFile(join(bundleDir, "skills", "coordinator", "SKILL.md"), "# coordinator\n");
      }
      if (options.entry && source.startsWith("./skills/")) {
        await mkdir(join(bundleDir, source), { recursive: true });
        await writeFile(join(bundleDir, source, "SKILL.md"), `# ${name}\n`);
      }
      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify({
          schemaVersion: "0.1",
          ...(options.team
            ? { kind: "team", coordinator: "./skills/coordinator", members: [source] }
            : {}),
          name,
          version,
          description: `${name} workflow.`,
          skills: [
            ...(options.team ? [{ source: "./skills/coordinator", entry: true }] : []),
            { source, ...(options.entry ? { entry: true } : {}) },
          ],
          steps: [{ id: "run", title: "Run", skill: source }],
        }),
      );
    };
    await writeManifest(catalogParentDir, "catalog-parent", "1.0.0", "catalog:catalog-child", {
      team: true,
    });
    await writeManifest(
      installedParentDir,
      "installed-parent",
      "1.0.0",
      "installed:installed-child",
      { team: true },
    );
    await writeManifest(installedChildDir, "installed-child", "3.0.0", "./skills/installed-entry", {
      entry: true,
    });
    await installWorkflowBundle({
      rootDir,
      bundle: await loadWorkflowBundle(installedChildDir),
    });

    try {
      const catalogGraph = await resolveWorkflowDependencyGraph({
        bundle: await loadWorkflowBundle(catalogParentDir),
        runGitCommand: async (command) => {
          if (command.args[0] === "clone") {
            const checkoutDir = command.args.at(-1) ?? "";
            await writeManifest(
              join(checkoutDir, "examples", "workflows", "catalog-child"),
              "catalog-child",
              "2.0.0",
              "./skills/catalog-entry",
              { entry: true },
            );
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "catalog-commit\n", stderr: "", exitCode: 0 };
        },
      });
      const installedGraph = await resolveWorkflowDependencyGraph({
        bundle: await loadWorkflowBundle(installedParentDir),
        installedRootDir: rootDir,
      });
      const installedLock = await createWorkflowLockFile(
        await loadWorkflowBundle(installedParentDir),
        { installedRootDir: rootDir, generatedAt: "2026-07-14T00:00:00.000Z" },
      );

      expect(catalogGraph.dependencies).toHaveLength(2);
      expect(catalogGraph.dependencies[1]?.source).toEndWith("skills/catalog-entry");
      expect(installedGraph.dependencies.map(({ source }) => source)).toEqual([
        join(installedParentDir, "skills", "coordinator"),
        join(installedChildDir, "skills", "installed-entry"),
      ]);
      expect(catalogGraph.workflows.map((workflow) => workflow.name)).toEqual([
        "catalog-parent",
        "catalog-child",
      ]);
      expect(installedGraph.workflows.map((workflow) => workflow.name)).toEqual([
        "installed-parent",
        "installed-child",
      ]);
      expect(installedLock.schemaVersion).toBe("0.2");
      if (installedLock.schemaVersion === "0.2") {
        expect(installedLock.workflows.map((workflow) => workflow.name)).toEqual([
          "installed-parent",
          "installed-child",
        ]);
      }
      await catalogGraph.cleanup?.();
      await installedGraph.cleanup?.();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("reuses a locked git child commit without default-branch lookup", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-locked-child-"));
    const parentDir = join(rootDir, "parent");
    const source = "https://github.com/acme/child.git";
    const lockedCommit = "0123456789abcdef";
    const commands: WorkflowGitCommand[] = [];
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
      const bundle = await loadWorkflowBundle(parentDir);
      const leafHash = createHash("sha256")
        .update("omniskill-workflow-lock-external-skill-v0.1\n")
        .update("source:child-leaf\n")
        .update("repo:\n")
        .digest("hex");
      bundle.lock = WorkflowLockFileSchema.parse({
        schemaVersion: "0.2",
        workflow: "parent",
        workflowVersion: "1.0.0",
        generatedAt: "2026-07-14T00:00:00.000Z",
        workflows: [
          {
            id: "workflow:parent@1.0.0",
            name: "parent",
            version: "1.0.0",
            source: { kind: "local", path: "." },
          },
          {
            id: "workflow:child@2.0.0",
            name: "child",
            version: "2.0.0",
            source: { kind: "git", url: source, commit: lockedCommit },
          },
        ],
        edges: [{ from: "workflow:parent@1.0.0", to: "workflow:child@2.0.0" }],
        skills: [
          {
            source: "child-leaf",
            resolvedName: "child-leaf",
            kind: "external",
            hash: `sha256:${leafHash}`,
          },
        ],
      });

      const graph = await resolveWorkflowDependencyGraph({
        bundle,
        runGitCommand: async (command) => {
          commands.push(command);
          if (command.args[0] === "init") {
            const checkoutDir = command.args.at(-1) ?? "";
            await mkdir(checkoutDir, { recursive: true });
            await writeFile(
              join(checkoutDir, "workflow.json"),
              JSON.stringify({
                schemaVersion: "0.1",
                name: "child",
                version: "2.0.0",
                description: "Locked child.",
                skills: [{ source: "child-leaf" }],
                steps: [{ id: "run", title: "Run", skill: "child-leaf" }],
              }),
            );
          }
          return {
            stdout: command.args[0] === "rev-parse" ? `${lockedCommit}\n` : "",
            stderr: "",
            exitCode: 0,
          };
        },
      });

      expect(commands.map((command) => command.args[0])).toEqual([
        "init",
        "remote",
        "fetch",
        "checkout",
        "rev-parse",
      ]);
      expect(commands.find((command) => command.args[0] === "fetch")?.args).toContain(lockedCommit);
      expect(graph.workflows[1]?.source).toMatchObject({ commit: lockedCommit });
      await graph.cleanup?.();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects a legacy lock for a nested workflow with a regeneration error", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-legacy-nested-lock-"));
    const parentDir = join(rootDir, "parent");
    const childDir = join(parentDir, "child");
    await mkdir(childDir, { recursive: true });
    const manifest = (name: string, source: string) => ({
      schemaVersion: "0.1",
      name,
      version: "1.0.0",
      description: `${name} workflow.`,
      skills: [{ source }],
      steps: [{ id: "run", title: "Run", skill: source }],
    });
    await writeFile(
      join(parentDir, "workflow.json"),
      JSON.stringify(manifest("parent", "./child")),
    );
    await writeFile(
      join(childDir, "workflow.json"),
      JSON.stringify(manifest("child", "child-leaf")),
    );
    await writeFile(
      join(parentDir, workflowLockFileName),
      JSON.stringify({
        schemaVersion: "0.1",
        workflow: "parent",
        workflowVersion: "1.0.0",
        generatedAt: "2026-07-14T00:00:00.000Z",
        skills: [
          {
            source: "./child",
            resolvedName: "child",
            kind: "local",
            hash: `sha256:${"a".repeat(64)}`,
          },
        ],
      }),
    );

    try {
      const bundle = await loadWorkflowBundle(parentDir);
      await expect(resolveWorkflowDependencyGraph({ bundle })).rejects.toThrow(
        "Legacy workflow lock 0.1 cannot represent nested workflows; run omniskill lock",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects a stale transitive lock leaf fingerprint", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-stale-transitive-lock-"));
    const bundleDir = join(rootDir, "locked");
    await mkdir(join(bundleDir, "skills", "locked"), { recursive: true });
    await writeFile(join(bundleDir, "skills", "locked", "SKILL.md"), "# locked\n");
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify({
        schemaVersion: "0.1",
        name: "locked",
        version: "1.0.0",
        description: "Locked workflow.",
        skills: [{ source: "./skills/locked" }],
        steps: [{ id: "run", title: "Run", skill: "./skills/locked" }],
      }),
    );

    try {
      const bundle = await loadWorkflowBundle(bundleDir);
      const lock = await createWorkflowLockFile(bundle, {
        generatedAt: "2026-07-14T00:00:00.000Z",
      });
      if (lock.schemaVersion !== "0.2") {
        throw new Error("Expected a transitive lock");
      }
      const lockedSkill = lock.skills[0];
      if (!lockedSkill) {
        throw new Error("Expected a locked skill");
      }
      lock.skills[0] = { ...lockedSkill, hash: `sha256:${"f".repeat(64)}` };
      bundle.lock = lock;

      await expect(resolveWorkflowDependencyGraph({ bundle })).rejects.toThrow(
        "Transitive workflow lock does not match resolved dependency graph",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid semantic prerelease identifiers", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-invalid-semver-"));
    try {
      for (const version of ["1.0.0-alpha..1", "1.0.0-alpha.01"]) {
        const bundleDir = join(rootDir, version.replaceAll(".", "-"));
        await mkdir(bundleDir, { recursive: true });
        await writeFile(
          join(bundleDir, "workflow.json"),
          JSON.stringify({
            schemaVersion: "0.1",
            name: "invalid-version",
            version,
            description: "Invalid version workflow.",
            skills: [{ source: "leaf" }],
            steps: [{ id: "run", title: "Run", skill: "leaf" }],
          }),
        );
        await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
          `Invalid workflow semantic version: ${version}`,
        );
      }
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("parses first-class team metadata while legacy manifests remain workflows", () => {
    const team = WorkflowBundleManifestSchema.parse(validTeamManifest);
    const legacy = WorkflowBundleManifestSchema.parse({
      schemaVersion: "0.1",
      name: "legacy-workflow",
      version: "0.1.0",
      description: "A legacy workflow without an explicit kind.",
      skills: [{ source: "skill-a" }],
      steps: [{ id: "run", title: "Run", skill: "skill-a" }],
    });

    expect(team.kind).toBe("team");
    expect(team.coordinator).toBe("./skills/coordinator");
    expect(team.members).toEqual(["catalog:member-workflow"]);
    expect(legacy.kind).toBeUndefined();
    expect(getWorkflowInvocationSkillName(team)).toBe("coordinator");
    expect(getWorkflowInvocationSkillName(legacy)).toBeNull();
  });

  test("rejects invalid team coordinator and member contracts", () => {
    const invalidCases = [
      {
        manifest: { ...validTeamManifest, coordinator: undefined },
        message: "Team manifests must declare a coordinator",
      },
      {
        manifest: { ...validTeamManifest, members: [] },
        message: "Team manifests must declare at least one member",
      },
      {
        manifest: { ...validTeamManifest, coordinator: "./skills/missing" },
        message: "Team coordinator references unknown skill: ./skills/missing",
      },
      {
        manifest: { ...validTeamManifest, coordinator: "external-review" },
        message: "Team coordinator must be a local skill path: external-review",
      },
      {
        manifest: {
          ...validTeamManifest,
          skills: validTeamManifest.skills.map((skill) =>
            skill.source === validTeamManifest.coordinator ? { source: skill.source } : skill,
          ),
        },
        message: "Team coordinator must be marked as the entry skill",
      },
      {
        manifest: { ...validTeamManifest, members: ["./skills/missing"] },
        message: "Team member references unknown skill: ./skills/missing",
      },
      {
        manifest: {
          ...validTeamManifest,
          members: ["catalog:member-workflow", "catalog:member-workflow"],
        },
        message: "Duplicate team member: catalog:member-workflow",
      },
      {
        manifest: { ...validTeamManifest, members: ["./skills/coordinator"] },
        message: "Team coordinator cannot also be a member: ./skills/coordinator",
      },
    ];

    for (const invalidCase of invalidCases) {
      expect(() => WorkflowBundleManifestSchema.parse(invalidCase.manifest)).toThrow(
        invalidCase.message,
      );
    }
  });

  test("rejects team-only metadata on workflow manifests", () => {
    expect(() =>
      WorkflowBundleManifestSchema.parse({ ...validTeamManifest, kind: "workflow" }),
    ).toThrow("Workflow manifests cannot declare coordinator or members");
  });

  test("rejects duplicate workflow step ids", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-"));
    const bundleDir = join(rootDir, "duplicate-steps");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "duplicate-steps",
          version: "0.1.0",
          description: "Invalid duplicate step ids.",
          skills: [{ source: "pony-trail" }],
          steps: [
            { id: "same", title: "First", skill: "pony-trail" },
            { id: "same", title: "Second", skill: "pony-trail" },
          ],
        },
        null,
        2,
      ),
    );

    await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow("Duplicate workflow step id: same");
  });

  test("loads a looped workflow manifest with entry skill and step instructions", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-loop-"));
    const bundleDir = join(rootDir, "looped-workflow");
    await mkdir(join(bundleDir, "skills", "looped-workflow"), { recursive: true });
    await writeFile(
      join(bundleDir, "skills", "looped-workflow", "SKILL.md"),
      [
        "---",
        "name: looped-workflow",
        'description: "Loop-enabled entry skill."',
        "---",
        "",
        "# looped-workflow",
      ].join("\n"),
    );
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "looped-workflow",
          version: "0.1.0",
          description: "Uses a loop runtime.",
          loop: {
            script: "./loop.mjs",
            state: "global",
            execution: "action-only",
            type: "goal_based",
            goal: "Finish the entry workflow.",
            done_when: ["entry_result_logged"],
            stop_when: ["workflow_complete"],
          },
          skills: [{ source: "./skills/looped-workflow", entry: true }],
          steps: [
            {
              id: "entry",
              title: "Run the entry skill",
              skill: "./skills/looped-workflow",
              instruction: "Check loop status before doing the next phase.",
              verify: {
                type: "event",
                event: "phase_result",
                message_includes: "entry result",
              },
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const bundle = await loadWorkflowBundle(bundleDir);

      expect(bundle.manifest.loop).toEqual({
        script: "./loop.mjs",
        state: "global",
        execution: "action-only",
        type: "goal_based",
        goal: "Finish the entry workflow.",
        done_when: ["entry_result_logged"],
        stop_when: ["workflow_complete"],
      });
      expect(bundle.manifest.skills).toEqual([{ source: "./skills/looped-workflow", entry: true }]);
      expect(bundle.manifest.steps[0]?.instruction).toBe(
        "Check loop status before doing the next phase.",
      );
      expect(bundle.manifest.steps[0]?.verify).toEqual({
        type: "event",
        event: "phase_result",
        message_includes: "entry result",
      });
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("loads grilled-product-dev as a looped workflow example", async () => {
    const bundle = await loadWorkflowBundle(
      join(import.meta.dir, "..", "examples", "workflows", "grilled-product-dev"),
    );

    expect(bundle.manifest.loop).toEqual({
      script: "./loop.mjs",
      state: "global",
      execution: "action-only",
      type: "goal_based",
      goal: "Produce an approved implementation plan for a product-development request.",
      done_when: [
        "grilled_direction_approved",
        "design_spec_approved",
        "implementation_plan_written",
      ],
      stop_when: ["human_blocks", "verification_fails", "workflow_complete"],
    });
    expect(bundle.manifest.skills[0]).toEqual({
      source: "./skills/grilled-product-dev",
      entry: true,
    });
    expect(bundle.manifest.steps.map((step) => step.id)).toEqual(["grill", "shape", "plan"]);
    expect(bundle.manifest.steps.map((step) => step.verify)).toEqual([
      {
        type: "human_approval",
        event: "approval",
        message_includes: "direction ready",
      },
      {
        type: "human_approval",
        event: "approval",
        message_includes: "design approved",
      },
      {
        type: "event",
        event: "phase_result",
        message_includes: "implementation plan written",
      },
    ]);
    expect(bundle.manifest.steps.map((step) => step.instruction)).toEqual([
      "Ask one grilling question, include your recommended answer, and wait for explicit human approval before advancing.",
      "Turn the approved direction into a Superpowers design spec, then wait for explicit human approval before advancing.",
      "Write the approved implementation plan as small executable tasks, then log the plan result.",
    ]);
    expect(createWorkflowLoopMetadata(bundle)).toEqual({
      schemaVersion: "0.1",
      workflow: "grilled-product-dev",
      entrySkill: "./skills/grilled-product-dev",
      loopScript: "./loop.mjs",
      state: "global",
      execution: "action-only",
      type: "goal_based",
      goal: "Produce an approved implementation plan for a product-development request.",
      done_when: [
        "grilled_direction_approved",
        "design_spec_approved",
        "implementation_plan_written",
      ],
      stop_when: ["human_blocks", "verification_fails", "workflow_complete"],
      commands: ["start", "status", "log", "advance", "summary"],
    });
  });

  test("loads curated workflow examples with checked skill locks and no pony-trail dependency", async () => {
    const curatedWorkflowNames = [
      "ceo",
      "cto",
      "product-manager",
      "engineering-manager",
      "founding-engineer",
      "qa-lead",
      "web-design",
      "haaland",
    ];

    for (const workflowName of curatedWorkflowNames) {
      const bundle = await loadWorkflowBundle(
        join(import.meta.dir, "..", "examples", "workflows", workflowName),
      );

      expect(bundle.manifest.name).toBe(workflowName);
      expect(bundle.lock?.workflow).toBe(workflowName);
      expect(bundle.lock?.skills.map((skill) => skill.source)).toEqual(
        bundle.manifest.skills.map((skill) => skill.source),
      );
      expect(bundle.manifest.skills.map((skill) => skill.source)).not.toContain("pony-trail");
    }

    const startupTeam = await loadWorkflowBundle(
      join(import.meta.dir, "..", "examples", "teams", "startup-team"),
    );
    expect(startupTeam.manifest.name).toBe("startup-team");
    expect(startupTeam.lock?.workflow).toBe("startup-team");
    expect(startupTeam.lock?.schemaVersion).toBe("0.2");
    if (startupTeam.lock?.schemaVersion === "0.2") {
      expect(startupTeam.lock.workflows.map(({ name }) => name)).toEqual([
        "startup-team",
        "ceo",
        "cto",
        "product-manager",
        "web-design",
        "engineering-manager",
        "founding-engineer",
        "qa-lead",
      ]);
      expect(startupTeam.lock.edges).toHaveLength(7);
      expect(startupTeam.lock.skills.map((skill) => skill.source)).toContain(
        "workflow:ceo@0.1.1#./skills/ceo",
      );
    }
    expect(startupTeam.manifest.skills.map((skill) => skill.source)).not.toContain("pony-trail");
  });

  test("pins every Matt Pocock example dependency to the v1.1.0 catalog", async () => {
    const mattPocockWorkflowNames = [
      "ceo",
      "cto",
      "development-design-delivery",
      "engineering-manager",
      "founding-engineer",
      "grilled-product-dev",
      "openspec-superpowers",
      "product-manager",
      "qa-lead",
      "real-engineering",
    ] as const;
    const mattPocockV1_1Repo = "https://github.com/mattpocock/skills/tree/v1.1.0";
    const retiredMattPocockSources = [
      "mattpocock:decision-mapping",
      "mattpocock:to-prd",
      "mattpocock:to-issues",
      "mattpocock:review",
      "mattpocock:design-an-interface",
    ];

    for (const workflowName of mattPocockWorkflowNames) {
      const bundle = await loadWorkflowBundle(
        join(import.meta.dir, "..", "examples", "workflows", workflowName),
      );
      const mattPocockSkills = bundle.manifest.skills.filter((skill) =>
        skill.source.startsWith("mattpocock:"),
      );
      const stepSources = bundle.manifest.steps.map((step) => step.skill);

      expect(mattPocockSkills).not.toHaveLength(0);
      for (const skill of mattPocockSkills) {
        expect(skill.repo).toBe(mattPocockV1_1Repo);
        expect(retiredMattPocockSources).not.toContain(skill.source);
      }
      for (const source of stepSources) {
        expect(retiredMattPocockSources).not.toContain(source);
      }
    }

    const startupTeam = await loadWorkflowBundle(
      join(import.meta.dir, "..", "examples", "teams", "startup-team"),
    );
    const startupTeamMattPocockSkills = startupTeam.manifest.skills.filter((skill) =>
      skill.source.startsWith("mattpocock:"),
    );
    expect(startupTeamMattPocockSkills).not.toHaveLength(0);
    for (const skill of startupTeamMattPocockSkills) {
      expect(skill.repo).toBe(mattPocockV1_1Repo);
      expect(retiredMattPocockSources).not.toContain(skill.source);
    }
    for (const source of startupTeam.manifest.steps.map((step) => step.skill)) {
      expect(retiredMattPocockSources).not.toContain(source);
    }

    const developmentDesignDelivery = await loadWorkflowBundle(
      join(import.meta.dir, "..", "examples", "workflows", "development-design-delivery"),
    );
    expect(developmentDesignDelivery.manifest.steps.map((step) => [step.id, step.skill])).toEqual(
      expect.arrayContaining([
        ["interface-design", "mattpocock:prototype"],
        ["review", "mattpocock:code-review"],
      ]),
    );
  });

  test("web design workflow uses Emil Kowalski design and animation reviews", async () => {
    const workflowDir = join(import.meta.dir, "..", "examples", "workflows", "web-design");
    const bundle = await loadWorkflowBundle(workflowDir);
    const skill = await readFile(join(workflowDir, "skills", "web-design", "SKILL.md"), "utf8");

    expect(bundle.manifest.skills).toEqual([
      { source: "./skills/web-design", entry: true },
      { source: "emilkowalski:emil-design-eng", repo: "emilkowalski/skills" },
      { source: "emilkowalski:animation-vocabulary", repo: "emilkowalski/skills" },
      { source: "emilkowalski:apple-design", repo: "emilkowalski/skills" },
      { source: "emilkowalski:review-animations", repo: "emilkowalski/skills" },
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill, step.gate ?? null])).toEqual([
      ["design-brief", "./skills/web-design", "human_approval"],
      ["motion-vocabulary", "emilkowalski:animation-vocabulary", null],
      ["craft-review", "emilkowalski:emil-design-eng", null],
      ["animation-review", "emilkowalski:review-animations", null],
    ]);
    expect(skill).toContain("## Required Companion Skills");
    expect(skill).toContain("interface-craft:design-engineering");
    expect(skill).toContain("interface-craft:motion-review");
    expect(skill).toContain("Before | After | Why");
    expect(skill).toContain("**Approve** or **Block**");
    expect(skill).toContain("If a companion skill is unavailable");
  });

  test("startup team entry skill dispatches role subagents and combines results", async () => {
    const canonicalMembers = [
      "catalog:ceo",
      "catalog:cto",
      "catalog:product-manager",
      "catalog:web-design",
      "catalog:engineering-manager",
      "catalog:founding-engineer",
      "catalog:qa-lead",
    ];
    const bundle = await loadWorkflowBundle(
      join(import.meta.dir, "..", "examples", "teams", "startup-team"),
    );
    const skill = await readFile(
      join(
        import.meta.dir,
        "..",
        "examples",
        "teams",
        "startup-team",
        "skills",
        "startup-goal",
        "SKILL.md",
      ),
      "utf8",
    );

    expect(bundle.manifest).toMatchObject({
      kind: "team",
      name: "startup-team",
      version: "0.2.0",
      coordinator: "./skills/startup-goal",
      members: canonicalMembers,
    });
    expect(
      bundle.manifest.skills.find((candidate) => candidate.source === bundle.manifest.coordinator),
    ).toEqual({ source: "./skills/startup-goal", entry: true });
    expect(bundle.lock?.workflow).toBe("startup-team");
    expect(bundle.lock?.workflowVersion).toBe("0.2.0");

    expect(bundle.manifest.steps.map((step) => [step.id, step.skill, step.gate ?? null])).toEqual([
      ["requirements", "superpowers:brainstorming", "human_approval"],
      ["route", "./skills/startup-goal", "human_approval"],
      ["strategy", "catalog:ceo", "human_approval"],
      ["product", "catalog:product-manager", null],
      ["design", "catalog:web-design", null],
      ["technology", "catalog:cto", null],
      ["delivery", "catalog:engineering-manager", null],
      ["implementation", "catalog:founding-engineer", null],
      ["implement", "mattpocock:implement", null],
      ["qa", "catalog:qa-lead", null],
    ]);
    expect(bundle.manifest.steps[0]?.instruction).toContain(
      "Interview the user one question at a time",
    );
    expect(bundle.manifest.skills).toEqual([
      { source: "./skills/startup-goal", entry: true },
      ...canonicalMembers.map((source) => ({ source })),
      { source: "superpowers:brainstorming", repo: "obra/superpowers" },
      {
        source: "mattpocock:implement",
        repo: "https://github.com/mattpocock/skills/tree/v1.1.0",
      },
    ]);
    expect(bundle.manifest.skills).not.toContainEqual({ source: "implement" });

    const graph = await resolveWorkflowDependencyGraph({
      bundle,
      ignoreLockValidation: true,
      runGitCommand: async (command) => {
        if (command.args[0] === "clone") {
          const checkoutDir = command.args.at(-1) ?? "";
          await cp(join(import.meta.dir, "..", "examples"), join(checkoutDir, "examples"), {
            recursive: true,
          });
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return { stdout: "fixture-commit\n", stderr: "", exitCode: 0 };
      },
    });
    expect(graph.workflows.map(({ name }) => name)).toEqual([
      "startup-team",
      ...canonicalMembers.map((source) => source.slice("catalog:".length)),
    ]);
    expect(graph.edges).toHaveLength(7);
    for (const role of canonicalMembers.map((source) => source.slice("catalog:".length))) {
      expect(
        graph.dependencies.filter(({ source }) => source.endsWith(`/skills/${role}`)),
      ).toHaveLength(1);
      await expect(
        stat(join(import.meta.dir, "..", "examples", "teams", "startup-team", "skills", role)),
      ).rejects.toThrow();
    }
    expect(graph.dependencies.filter(({ source }) => source === "implement")).toHaveLength(0);
    expect(graph.dependencies.filter(({ source }) => source === "mattpocock:implement")).toEqual([
      {
        source: "mattpocock:implement",
        repo: "https://github.com/mattpocock/skills/tree/v1.1.0",
      },
    ]);
    await graph.cleanup?.();
    expect(skill).toContain("name: startup-goal");
    for (const heading of [
      "## 1. Clarify",
      "## 2. Approve",
      "## 3. Route",
      "## 4. Dispatch",
      "## 5. Combine",
    ]) {
      expect(skill).toContain(heading);
    }
    expect(skill).toContain("one material question at a time");
    expect(skill).toContain("explicit approval");
    expect(skill).toContain("smallest safe role set");
    expect(skill).toContain("Present the route plan and wait for explicit approval");
    expect(skill).toContain("Every run must show");
    expect(skill).toContain("Skipped roles, including `none`");
    expect(skill).toContain("one role-scoped subagent per selected role");
    expect(skill).toContain("Unavailable dispatch");
    expect(skill).toContain("accountable decision log");
    expect(skill).toContain("web-design");
    expect(skill).toContain("`founding-engineer`: implementation framing and execution handoff");
    expect(skill).toContain("When `founding-engineer` is selected, it must not edit files");
    expect(skill).toContain("dispatch `implement` with that handoff as the only");
    expect(skill).toContain("then hand the result to `qa-lead`");

    for (const { role } of startupRoleContracts) {
      const roleSkill = await readStartupRoleSkill(role);
      for (const contract of ["## Required Companion Skills", "## Operating Mode"]) {
        expect(roleSkill).toContain(contract);
      }
    }
  });

  test("canonical startup role skills define role-specific operating modes", async () => {
    for (const contract of startupRoleContracts) {
      const skill = await readStartupRoleSkill(contract.role);

      expect(skill).toContain(`name: ${contract.role}`);
      expect(skill).toContain("## Required Companion Skills");
      expect(skill).toContain("If a companion skill is unavailable");
      expect(skill).toContain("## Operating Mode");
      for (const phrase of contract.phrases) {
        expect(skill).toContain(phrase);
      }
    }
  });

  test("startup team separates implementation framing from execution", async () => {
    const skill = await readStartupRoleSkill("founding-engineer");

    for (const phrase of [
      "smallest correct change",
      "focused tests",
      "smallest useful verification loop",
      "Debug from evidence",
      "commands run",
    ]) {
      expect(skill).toContain(phrase);
    }
    expect(skill).toContain("before editing");
    expect(skill).not.toContain("Do not edit files or run implementation commands");
  });

  test("haaland workflow stays one-step and unconditional", async () => {
    const bundle = await loadWorkflowBundle(
      join(import.meta.dir, "..", "examples", "workflows", "haaland"),
    );
    const skill = await readFile(
      join(
        import.meta.dir,
        "..",
        "examples",
        "workflows",
        "haaland",
        "skills",
        "haaland",
        "SKILL.md",
      ),
      "utf8",
    );
    const profileIconPath = join(
      import.meta.dir,
      "..",
      "examples",
      "workflows",
      "haaland",
      "skills",
      "haaland",
      "assets",
      "haaland-profile-icon.svg",
    );
    const profileIcon = await readFile(profileIconPath, "utf8");

    expect(bundle.manifest.skills).toEqual([{ source: "./skills/haaland", entry: true }]);
    expect(bundle.manifest.steps).toEqual([
      { id: "finish", title: "Create one Haaland meme", skill: "./skills/haaland" },
    ]);
    expect(skill).toContain("Create exactly one finished meme concept");
    expect(skill).toContain("assets/haaland-profile-icon.svg");
    expect(skill).not.toContain("Required Companion Skills");
    expect(skill).not.toContain("If a companion skill is unavailable");
    expect(profileIcon).toContain("Haaland profile icon");
    await expect(
      readFile(join(profileIconPath, "..", "haaland-meme-logo.svg"), "utf8"),
    ).rejects.toThrow();
  });

  test("rejects looped workflows without exactly one entry skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-loop-entry-"));
    const bundleDir = join(rootDir, "bad-loop");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(join(bundleDir, "loop.mjs"), "export {};\n");

    try {
      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "bad-loop",
            version: "0.1.0",
            description: "Missing entry skill.",
            loop: { script: "./loop.mjs", state: "global", execution: "action-only" },
            skills: [{ source: "./skills/bad-loop" }],
            steps: [{ id: "entry", title: "Entry", skill: "./skills/bad-loop" }],
          },
          null,
          2,
        ),
      );
      await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
        "Looped workflows must declare exactly one entry skill",
      );

      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "bad-loop",
            version: "0.1.0",
            description: "Multiple entry skills.",
            loop: { script: "./loop.mjs", state: "global", execution: "action-only" },
            skills: [
              { source: "./skills/one", entry: true },
              { source: "./skills/two", entry: true },
            ],
            steps: [{ id: "entry", title: "Entry", skill: "./skills/one" }],
          },
          null,
          2,
        ),
      );
      await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
        "Only one workflow skill can be marked as entry",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects non-local entry skills in looped workflows", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-loop-nonlocal-"));
    const bundleDir = join(rootDir, "bad-loop");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(join(bundleDir, "loop.mjs"), "export {};\n");
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "bad-loop",
          version: "0.1.0",
          description: "Entry skill is not local.",
          loop: { script: "./loop.mjs", state: "global", execution: "action-only" },
          skills: [{ source: "superpowers:brainstorming", entry: true }],
          steps: [{ id: "entry", title: "Entry", skill: "superpowers:brainstorming" }],
        },
        null,
        2,
      ),
    );

    try {
      await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
        "Looped workflow entry skill must be a local skill path",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects invalid generated loop script paths", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-loop-path-"));
    const bundleDir = join(rootDir, "bad-loop-path");
    await mkdir(join(bundleDir, "skills", "bad-loop-path"), { recursive: true });
    await writeFile(
      join(bundleDir, "skills", "bad-loop-path", "SKILL.md"),
      [
        "---",
        "name: bad-loop-path",
        'description: "Entry skill."',
        "---",
        "",
        "# bad-loop-path",
      ].join("\n"),
    );

    async function writeManifest(script: string): Promise<void> {
      await writeFile(
        join(bundleDir, "workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "bad-loop-path",
            version: "0.1.0",
            description: "Invalid loop script path.",
            loop: { script, state: "global", execution: "action-only" },
            skills: [{ source: "./skills/bad-loop-path", entry: true }],
            steps: [{ id: "entry", title: "Entry", skill: "./skills/bad-loop-path" }],
          },
          null,
          2,
        ),
      );
    }

    try {
      await writeManifest("/tmp/loop.mjs");
      await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
        "Workflow loop script must be a relative path",
      );

      await writeManifest("../loop.mjs");
      await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
        "Workflow loop script must stay inside the workflow bundle",
      );

      await writeManifest("./loop.js");
      await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
        "Workflow loop script must use a .mjs extension",
      );

      await writeManifest("./generated-loop.mjs");
      const bundle = await loadWorkflowBundle(bundleDir);
      expect(bundle.manifest.loop?.script).toBe("./generated-loop.mjs");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("loads workflow skill repository metadata for external skill installs", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-repo-"));
    const bundleDir = join(rootDir, "repo-skills");
    await mkdir(bundleDir, { recursive: true });
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "repo-skills",
          version: "0.1.0",
          description: "Uses repo metadata for Skills CLI installs.",
          skills: [
            {
              source: "superpowers:brainstorming",
              repo: "obra/superpowers",
            },
          ],
          steps: [
            {
              id: "brainstorming",
              title: "Shape the work",
              skill: "superpowers:brainstorming",
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const bundle = await loadWorkflowBundle(bundleDir);

      expect(bundle.manifest.skills).toEqual([
        {
          source: "superpowers:brainstorming",
          repo: "obra/superpowers",
        },
      ]);
      expect(getWorkflowSkillInstallDependencies(bundle)).toEqual([
        {
          source: "superpowers:brainstorming",
          repo: "obra/superpowers",
        },
      ]);
      const install = await installWorkflowBundle({ rootDir, bundle });
      const installed = JSON.parse(await readFile(install.path, "utf8"));
      expect(installed.skills).toEqual([
        {
          source: "superpowers:brainstorming",
          repo: "obra/superpowers",
        },
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("creates deterministic workflow lock files for local and external skills", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-lock-"));
    const bundleDir = join(rootDir, "locked-workflow");
    await mkdir(join(bundleDir, "skills", "locked-workflow", "nested"), { recursive: true });
    await writeFile(
      join(bundleDir, "skills", "locked-workflow", "SKILL.md"),
      [
        "---",
        "name: locked-workflow",
        'description: "Locked workflow entry skill."',
        "---",
        "",
        "# locked-workflow",
      ].join("\n"),
    );
    await writeFile(join(bundleDir, "skills", "locked-workflow", "nested", "notes.md"), "notes\n");
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "locked-workflow",
          version: "0.1.0",
          description: "Uses locked skill fingerprints.",
          skills: [
            { source: "./skills/locked-workflow", entry: true },
            { source: "superpowers:writing-plans", repo: "obra/superpowers" },
          ],
          steps: [
            { id: "entry", title: "Entry", skill: "./skills/locked-workflow" },
            { id: "plan", title: "Plan", skill: "superpowers:writing-plans" },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const bundle = await loadWorkflowBundle(bundleDir);
      expect(bundle.lock).toBeUndefined();

      const lock = await createWorkflowLockFile(bundle, {
        generatedAt: "2026-07-07T00:00:00.000Z",
      });
      const secondLock = await createWorkflowLockFile(bundle, {
        generatedAt: "2026-07-07T00:00:00.000Z",
      });

      expect(secondLock).toEqual(lock);
      expect(lock.workflow).toBe("locked-workflow");
      expect(lock.skills).toMatchObject([
        {
          source: "./skills/locked-workflow",
          resolvedName: "locked-workflow",
          kind: "local",
        },
        {
          source: "superpowers:writing-plans",
          resolvedName: "superpowers-writing-plans",
          kind: "external",
          repo: "obra/superpowers",
        },
      ]);
      for (const skill of lock.skills) {
        expect(skill.hash).toMatch(/^sha256:[a-f0-9]{64}$/);
      }

      const written = await writeWorkflowLockFile(bundle, {
        generatedAt: "2026-07-07T00:00:00.000Z",
      });
      expect(written.path).toBe(join(bundleDir, workflowLockFileName));
      expect(await loadWorkflowLockFile(bundle)).toEqual(lock);

      const bundleWithLock = await loadWorkflowBundle(bundleDir);
      expect(bundleWithLock.lock).toEqual(lock);
      expect(bundleWithLock.lockPath).toBe(join(bundleDir, workflowLockFileName));
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("rejects workflow lock files that no longer match the manifest", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-lock-mismatch-"));
    const bundleDir = join(rootDir, "mismatched-lock");
    await mkdir(join(bundleDir, "skills", "mismatched-lock"), { recursive: true });
    await writeFile(
      join(bundleDir, "skills", "mismatched-lock", "SKILL.md"),
      [
        "---",
        "name: mismatched-lock",
        'description: "Mismatched lock entry skill."',
        "---",
        "",
        "# mismatched-lock",
      ].join("\n"),
    );
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "mismatched-lock",
          version: "0.1.0",
          description: "Rejects stale lock files.",
          skills: [{ source: "./skills/mismatched-lock", entry: true }],
          steps: [{ id: "entry", title: "Entry", skill: "./skills/mismatched-lock" }],
        },
        null,
        2,
      ),
    );
    await writeFile(
      join(bundleDir, workflowLockFileName),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          workflow: "different-workflow",
          workflowVersion: "0.1.0",
          generatedAt: "2026-07-07T00:00:00.000Z",
          skills: [
            {
              source: "./skills/mismatched-lock",
              resolvedName: "mismatched-lock",
              kind: "local",
              hash: "sha256:0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
            },
          ],
        },
        null,
        2,
      ),
    );

    try {
      await expect(loadWorkflowBundle(bundleDir)).rejects.toThrow(
        "Workflow lock file does not match manifest",
      );
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("scaffolds an authorable workflow bundle with a local skill", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-scaffold-"));

    const scaffold = await createWorkflowBundleScaffold({
      rootDir,
      name: "release-review",
    });

    await expect(stat(join(scaffold.bundleDir, "workflow.json"))).resolves.toBeTruthy();
    await expect(
      stat(join(scaffold.bundleDir, "skills", "custom-review", "SKILL.md")),
    ).resolves.toBeTruthy();
    await expect(
      stat(join(scaffold.bundleDir, "skills", "release-review", "SKILL.md")),
    ).resolves.toBeTruthy();

    const bundle = await loadWorkflowBundle(scaffold.bundleDir);
    expect(bundle.manifest.name).toBe("release-review");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain(
      "./skills/release-review",
    );
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain("./skills/custom-review");
    await expect(readFile(scaffold.readmePath, "utf8")).resolves.toContain(
      "An Omniskills workflow that composes reusable agent skills.",
    );
    await expect(
      readFile(join(scaffold.bundleDir, "skills", "release-review", "SKILL.md"), "utf8"),
    ).resolves.toContain("This is the entry skill for the release-review Omniskills workflow.");
    await expect(
      readFile(join(scaffold.bundleDir, "skills", "custom-review", "SKILL.md"), "utf8"),
    ).resolves.toContain("Review this Omniskills workflow from the author perspective.");
  });

  test("stores workflow install artifact metadata in installed records", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-install-artifacts-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");
    const installArtifacts: WorkflowInstallSkillArtifact[] = [
      {
        source: "./skills/release-risk-review",
        skillName: "release-risk-review",
        agent: "codex",
        status: "installed",
        paths: [
          join(rootDir, ".agents", "skills", "release-risk-review"),
          join(rootDir, ".codex", "skills", "release-risk-review"),
        ],
      },
    ];

    try {
      const install = await installWorkflowBundle({ rootDir, bundle, installArtifacts });
      const installed = JSON.parse(await readFile(install.path, "utf8"));

      expect(installed.installArtifacts).toEqual(installArtifacts);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("plans removal from recorded workflow artifacts", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-plan-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");
    const artifactPath = join(rootDir, ".agents", "skills", "release-risk-review");

    try {
      await installWorkflowBundle({
        rootDir,
        bundle,
        installArtifacts: [
          {
            source: "./skills/release-risk-review",
            skillName: "release-risk-review",
            agent: "codex",
            status: "installed",
            paths: [artifactPath],
          },
        ],
      });

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "release-review",
      });

      expect(plan.workflow.name).toBe("release-review");
      expect(plan.legacy).toBe(false);
      expect(plan.artifactsToRemove.map((artifact) => artifact.path)).toEqual([artifactPath]);
      expect(plan.artifactsToKeep).toEqual([]);
      expect(plan.skippedArtifacts).toEqual([]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("preserves artifacts referenced by another installed workflow", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-shared-"));
    const releaseBundle = await loadWorkflowBundle("examples/workflows/release-review");
    const sharedPath = join(rootDir, ".agents", "skills", "pony-trail");
    const otherBundle = {
      ...releaseBundle,
      manifest: { ...releaseBundle.manifest, name: "ops-review" },
    };

    try {
      await installWorkflowBundle({
        rootDir,
        bundle: releaseBundle,
        installArtifacts: [
          {
            source: "pony-trail",
            skillName: "pony-trail",
            agent: "codex",
            status: "installed",
            paths: [sharedPath],
          },
        ],
      });
      await installWorkflowBundle({
        rootDir,
        bundle: otherBundle,
        installArtifacts: [
          {
            source: "pony-trail",
            skillName: "pony-trail",
            agent: "codex",
            status: "installed",
            paths: [sharedPath],
          },
        ],
      });

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "release-review",
      });

      expect(plan.artifactsToRemove).toEqual([]);
      expect(plan.artifactsToKeep).toEqual([
        expect.objectContaining({ path: sharedPath, usedByWorkflows: ["ops-review"] }),
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("fails clearly when removing a workflow that is not installed", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-missing-"));

    try {
      await expect(
        createWorkflowRemovalPlan({
          rootDir,
          homeDir: rootDir,
          workflowName: "missing-workflow",
        }),
      ).rejects.toThrow("Omniskills workflow is not installed: missing-workflow");
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("executes a removal plan by deleting artifacts and the workflow record", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-execute-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");
    const artifactPath = join(rootDir, ".agents", "skills", "release-risk-review");

    try {
      await mkdir(artifactPath, { recursive: true });
      await writeFile(join(artifactPath, "SKILL.md"), "installed skill");
      const install = await installWorkflowBundle({
        rootDir,
        bundle,
        installArtifacts: [
          {
            source: "./skills/release-risk-review",
            skillName: "release-risk-review",
            agent: "codex",
            status: "installed",
            paths: [artifactPath],
          },
        ],
      });

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "release-review",
      });
      await executeWorkflowRemovalPlan(plan);

      await expect(stat(artifactPath)).rejects.toThrow();
      await expect(stat(install.path)).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("infers legacy removal artifacts and skips unmappable legacy sources", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-remove-legacy-"));
    const workflowDir = join(rootDir, ".omniskills", "workflows");

    try {
      await mkdir(workflowDir, { recursive: true });
      await writeFile(
        join(workflowDir, "legacy-workflow.json"),
        JSON.stringify(
          {
            schemaVersion: "0.1",
            name: "legacy-workflow",
            version: "0.1.0",
            description: "Legacy workflow record.",
            source: { kind: "local", path: "/tmp/legacy-workflow" },
            skills: [
              { source: "./skills/local-review" },
              { source: "superpowers:brainstorming" },
              { source: "https://example.com/unknown.git#skills/custom" },
            ],
            steps: [
              { id: "local", title: "Local", skill: "./skills/local-review" },
              { id: "shape", title: "Shape", skill: "superpowers:brainstorming" },
            ],
          },
          null,
          2,
        ),
      );

      const plan = await createWorkflowRemovalPlan({
        rootDir,
        homeDir: rootDir,
        workflowName: "legacy-workflow",
      });

      expect(plan.legacy).toBe(true);
      expect(plan.artifactsToRemove.map((artifact) => artifact.path)).toContain(
        join(rootDir, ".agents", "skills", "local-review"),
      );
      expect(plan.artifactsToRemove.map((artifact) => artifact.path)).toContain(
        join(rootDir, ".agents", "skills", "superpowers-brainstorming"),
      );
      expect(plan.skippedArtifacts).toEqual([
        {
          source: "https://example.com/unknown.git#skills/custom",
          reason:
            "Cannot safely infer installed skill name from https://example.com/unknown.git#skills/custom",
        },
      ]);
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("loads the release-review example workflow with its local skill", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");

    expect(bundle.manifest.name).toBe("release-review");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toContain(
      "./skills/release-risk-review",
    );
    expect(bundle.manifest.steps.map((step) => step.id)).toEqual([
      "shape",
      "release-risk-review",
      "plan",
      "evidence",
    ]);
  });

  test("loads the real-engineering example workflow with mattpocock skill sources", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/real-engineering");

    expect(bundle.manifest.name).toBe("real-engineering");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/rtk-command-discipline",
      "pony-trail",
      "superpowers:brainstorming",
      "superpowers:writing-plans",
      "mattpocock:grill-with-docs",
      "mattpocock:tdd",
      "mattpocock:codebase-design",
      "mattpocock:diagnosing-bugs",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
      ["command-discipline", "./skills/rtk-command-discipline"],
      ["shape", "superpowers:brainstorming"],
      ["grill", "mattpocock:grill-with-docs"],
      ["plan", "superpowers:writing-plans"],
      ["design", "mattpocock:codebase-design"],
      ["tdd", "mattpocock:tdd"],
      ["debug", "mattpocock:diagnosing-bugs"],
      ["evidence", "pony-trail"],
    ]);
  });

  test("loads the development-design-delivery example workflow", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/development-design-delivery");

    expect(bundle.manifest.name).toBe("development-design-delivery");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/development-design-delivery",
      "superpowers:brainstorming",
      "mattpocock:prototype",
      "mattpocock:grill-with-docs",
      "superpowers:writing-plans",
      "mattpocock:codebase-design",
      "mattpocock:tdd",
      "mattpocock:diagnosing-bugs",
      "mattpocock:code-review",
      "pony-trail",
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill, step.gate ?? null])).toEqual([
      ["shape", "superpowers:brainstorming", "human_approval"],
      ["interface-design", "mattpocock:prototype", "human_approval"],
      ["requirement-review", "mattpocock:grill-with-docs", "human_approval"],
      ["implementation-plan", "superpowers:writing-plans", null],
      ["architecture-boundary", "mattpocock:codebase-design", null],
      ["build", "mattpocock:tdd", null],
      ["debug", "mattpocock:diagnosing-bugs", null],
      ["review", "mattpocock:code-review", null],
      ["evidence", "pony-trail", null],
    ]);
    await expect(
      readFile(
        join(
          import.meta.dir,
          "..",
          "examples",
          "workflows",
          "development-design-delivery",
          "skills",
          "development-design-delivery",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).resolves.toContain(
      "This is the entry skill for the development-design-delivery Omniskills workflow.",
    );
  });

  test("loads the openspec delivery example workflow from the handoff diagram", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/openspec-superpowers");

    expect(bundle.manifest.name).toBe("openspec-delivery");
    expect(bundle.manifest.skills.map((skill) => skill.source)).toEqual([
      "./skills/openspec-delivery",
      "./skills/opsx-handoff-review",
      "superpowers:brainstorming",
      "superpowers:writing-plans",
      "mattpocock:tdd",
      "pony-trail",
    ]);
    expect(
      bundle.manifest.skills
        .filter((skill) => skill.source.includes(":"))
        .map((skill) => [skill.source, skill.repo]),
    ).toEqual([
      ["superpowers:brainstorming", "obra/superpowers"],
      ["superpowers:writing-plans", "obra/superpowers"],
      ["mattpocock:tdd", "https://github.com/mattpocock/skills/tree/v1.1.0"],
    ]);
    expect(bundle.manifest.steps.map((step) => [step.id, step.skill])).toEqual([
      ["opsx-propose", "./skills/opsx-handoff-review"],
      ["opsx-review", "./skills/opsx-handoff-review"],
      ["design-deepening", "superpowers:brainstorming"],
      ["implementation-plan", "superpowers:writing-plans"],
      ["task-by-task-build", "mattpocock:tdd"],
      ["verification", "pony-trail"],
      ["opsx-archive", "./skills/opsx-handoff-review"],
    ]);
    await expect(
      readFile(
        join(
          import.meta.dir,
          "..",
          "examples",
          "workflows",
          "openspec-superpowers",
          "skills",
          "openspec-delivery",
          "SKILL.md",
        ),
        "utf8",
      ),
    ).resolves.toContain("This is the entry skill for the openspec-delivery Omniskills workflow.");
  });

  test("loads a workflow bundle from a public git URL", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-"));
    const source = "https://github.com/acme/release-review.git";
    const commands: WorkflowGitCommand[] = [];
    let checkoutDir = "";

    const bundle = await loadWorkflowBundle(source, {
      tempDir,
      runGitCommand: async (command) => {
        commands.push(command);
        if (command.args[0] === "clone") {
          checkoutDir = command.args.at(-1) ?? "";
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
                description: "Installs from git.",
                skills: [{ source: "./skills/git-entry" }],
                steps: [{ id: "entry", title: "Entry", skill: "./skills/git-entry" }],
              },
              null,
              2,
            ),
          );
          return { stdout: "", stderr: "", exitCode: 0 };
        }

        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      },
    });

    expect(commands.map((command) => command.args[0])).toEqual(["clone", "rev-parse"]);
    expect(commands[0]?.args).toEqual(["clone", "--depth", "1", source, checkoutDir]);
    expect(bundle.manifest.name).toBe("git-workflow");
    expect(bundle.source).toEqual({ kind: "git", url: source, commit: "abc123" });
    expect(getWorkflowSkillInstallSources(bundle)).toEqual([
      join(checkoutDir, "skills", "git-entry"),
    ]);

    await bundle.cleanup?.();
    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loads a workflow alias from the canonical examples catalog", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-alias-"));
    const source = "openspec-superpowers";
    const canonicalUrl =
      "https://github.com/devos-ing/omni-skills.git#examples/workflows/openspec-superpowers";
    const commands: WorkflowGitCommand[] = [];
    let checkoutDir = "";

    const bundle = await loadWorkflowBundle(source, {
      tempDir,
      runGitCommand: async (command) => {
        commands.push(command);
        if (command.args[0] === "clone") {
          checkoutDir = command.args.at(-1) ?? "";
          const workflowDir = join(checkoutDir, "examples", "workflows", "openspec-superpowers");
          await mkdir(join(workflowDir, "skills", "openspec-delivery"), {
            recursive: true,
          });
          await writeFile(
            join(workflowDir, "skills", "openspec-delivery", "SKILL.md"),
            [
              "---",
              "name: openspec-delivery",
              'description: "Entry skill from the examples catalog."',
              "---",
              "",
              "# openspec-delivery",
            ].join("\n"),
          );
          await writeFile(
            join(workflowDir, "workflow.json"),
            JSON.stringify(
              {
                schemaVersion: "0.1",
                name: "openspec-delivery",
                version: "0.1.0",
                description: "Installs from the examples catalog.",
                skills: [{ source: "./skills/openspec-delivery" }],
                steps: [
                  {
                    id: "entry",
                    title: "Run OpenSpec delivery",
                    skill: "./skills/openspec-delivery",
                  },
                ],
              },
              null,
              2,
            ),
          );
          return { stdout: "", stderr: "", exitCode: 0 };
        }

        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      },
    });

    expect(commands.map((command) => command.args[0])).toEqual(["clone", "rev-parse"]);
    expect(commands[0]?.args).toEqual([
      "clone",
      "--depth",
      "1",
      "https://github.com/devos-ing/omni-skills.git",
      checkoutDir,
    ]);
    expect(bundle.manifest.name).toBe("openspec-delivery");
    expect(bundle.source).toEqual({
      kind: "git",
      url: canonicalUrl,
      commit: "abc123",
      subdirectory: "examples/workflows/openspec-superpowers",
    });
    expect(getWorkflowSkillInstallSources(bundle)).toEqual([
      join(
        checkoutDir,
        "examples",
        "workflows",
        "openspec-superpowers",
        "skills",
        "openspec-delivery",
      ),
    ]);

    await bundle.cleanup?.();
    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("resolves team aliases from examples/teams and retains team metadata", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-team-alias-"));
    const installRoot = await mkdtemp(join(tmpdir(), "workflow-team-install-"));
    let checkoutDir = "";

    const bundle = await loadWorkflowBundle("startup-team", {
      tempDir,
      runGitCommand: async (command) => {
        if (command.args[0] === "clone") {
          checkoutDir = command.args.at(-1) ?? "";
          await writeTeamBundleFixtureAt(join(checkoutDir, "examples", "teams", "startup-team"));
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      },
    });

    expect(bundle.manifest.kind).toBe("team");
    expect(bundle.manifest.coordinator).toBe("./skills/coordinator");
    expect(bundle.manifest.members).toEqual(["./skills/member"]);
    expect(bundle.source).toEqual({
      kind: "git",
      url: "https://github.com/devos-ing/omni-skills.git#examples/teams/startup-team",
      commit: "abc123",
      subdirectory: "examples/teams/startup-team",
    });

    const install = await installWorkflowBundle({ rootDir: installRoot, bundle });
    expect(install.workflow.kind).toBe("team");
    expect(install.workflow.coordinator).toBe("./skills/coordinator");
    expect(install.workflow.members).toEqual(["./skills/member"]);

    await bundle.cleanup?.();
    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(installRoot, { recursive: true, force: true });
    await rm(tempDir, { recursive: true, force: true });
  });

  test("rejects a workflow manifest resolved through a team alias", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-team-kind-mismatch-"));

    await expect(
      loadWorkflowBundle("startup-team", {
        tempDir,
        runGitCommand: async (command) => {
          if (command.args[0] === "clone") {
            const checkoutDir = command.args.at(-1) ?? "";
            await writeTeamBundleFixtureAt(
              join(checkoutDir, "examples", "teams", "startup-team"),
              "workflow",
            );
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
      }),
    ).rejects.toThrow('Omniskills team alias "startup-team" must resolve to kind: "team"');

    await rm(tempDir, { recursive: true, force: true });
  });

  test("does not redirect the startup-goal alias to startup-team", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-startup-goal-alias-"));

    await expect(
      loadWorkflowBundle("startup-goal", {
        tempDir,
        runGitCommand: async (command) => {
          if (command.args[0] === "clone") {
            const checkoutDir = command.args.at(-1) ?? "";
            await mkdir(join(checkoutDir, "examples", "workflows"), { recursive: true });
            await writeTeamBundleFixtureAt(join(checkoutDir, "examples", "teams", "startup-team"));
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
      }),
    ).rejects.toThrow(
      "Omniskills workflow alias not found: startup-goal\nChecked: https://github.com/devos-ing/omni-skills.git#examples/workflows/startup-goal",
    );

    await rm(tempDir, { recursive: true, force: true });
  });

  test("loads a public git workflow from a URL fragment subdirectory", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-subdir-"));
    const source = "https://github.com/acme/workflows.git#examples/release-review";
    const commands: WorkflowGitCommand[] = [];
    let checkoutDir = "";

    const bundle = await loadWorkflowBundle(source, {
      tempDir,
      runGitCommand: async (command) => {
        commands.push(command);
        if (command.args[0] === "clone") {
          checkoutDir = command.args.at(-1) ?? "";
          const workflowDir = join(checkoutDir, "examples", "release-review");
          await mkdir(join(workflowDir, "skills", "git-entry"), { recursive: true });
          await writeFile(
            join(workflowDir, "skills", "git-entry", "SKILL.md"),
            [
              "---",
              "name: git-entry",
              'description: "Entry skill from a public git workflow subdirectory."',
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
                name: "git-subdir-workflow",
                version: "0.1.0",
                description: "Installs from a git subdirectory.",
                skills: [{ source: "./skills/git-entry" }],
                steps: [{ id: "entry", title: "Entry", skill: "./skills/git-entry" }],
              },
              null,
              2,
            ),
          );
          return { stdout: "", stderr: "", exitCode: 0 };
        }

        return { stdout: "def456\n", stderr: "", exitCode: 0 };
      },
    });

    expect(commands[0]?.args).toEqual([
      "clone",
      "--depth",
      "1",
      "https://github.com/acme/workflows.git",
      checkoutDir,
    ]);
    expect(bundle.source).toEqual({
      kind: "git",
      url: source,
      commit: "def456",
      subdirectory: "examples/release-review",
    });
    expect(getWorkflowSkillInstallSources(bundle)).toEqual([
      join(checkoutDir, "examples", "release-review", "skills", "git-entry"),
    ]);

    await bundle.cleanup?.();
    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("loads a workflow from a file git URL with the default git runner", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-file-git-"));
    const sourceRepo = join(rootDir, "source");
    const tempDir = join(rootDir, "tmp");

    await mkdir(join(sourceRepo, "skills", "file-entry"), { recursive: true });
    await mkdir(tempDir, { recursive: true });
    await writeFile(
      join(sourceRepo, "skills", "file-entry", "SKILL.md"),
      [
        "---",
        "name: file-entry",
        'description: "Entry skill from a file git workflow."',
        "---",
        "",
        "# file-entry",
      ].join("\n"),
    );
    await writeFile(
      join(sourceRepo, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "file-git-workflow",
          version: "0.1.0",
          description: "Installs from a file git source.",
          skills: [{ source: "./skills/file-entry" }],
          steps: [{ id: "entry", title: "Entry", skill: "./skills/file-entry" }],
        },
        null,
        2,
      ),
    );
    await runGit(["init"], sourceRepo);
    await runGit(["config", "user.email", "test@example.invalid"], sourceRepo);
    await runGit(["config", "user.name", "Workflow Test"], sourceRepo);
    await runGit(["add", "."], sourceRepo);
    await runGit(["commit", "-m", "add workflow"], sourceRepo);

    const bundle = await loadWorkflowBundle(pathToFileURL(sourceRepo).href, { tempDir });

    expect(bundle.manifest.name).toBe("file-git-workflow");
    expect(bundle.source.kind).toBe("git");
    expect(bundle.source).toHaveProperty("commit");
    expect(getWorkflowSkillInstallSources(bundle)[0]).toContain("file-entry");
    await bundle.cleanup?.();
    expect((await readdir(tempDir)).filter((entry) => entry.startsWith("omniskill-git-"))).toEqual(
      [],
    );
    await rm(rootDir, { recursive: true, force: true });
  });

  test("reports public git clone failures with the source URL", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-failure-"));
    const source = "https://github.com/acme/missing-workflow.git";

    await expect(
      loadWorkflowBundle(source, {
        tempDir,
        runGitCommand: async () => ({
          stdout: "",
          stderr: "repository not found",
          exitCode: 128,
        }),
      }),
    ).rejects.toThrow(`Public git workflow source could not be fetched: ${source}`);

    expect(await readdir(tempDir)).toEqual([]);
    await rm(tempDir, { recursive: true, force: true });
  });

  test("cleans a public git checkout when workflow.json is missing", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-git-missing-"));
    let checkoutDir = "";

    await expect(
      loadWorkflowBundle("https://github.com/acme/not-a-workflow.git", {
        tempDir,
        runGitCommand: async (command) => {
          if (command.args[0] === "clone") {
            checkoutDir = command.args.at(-1) ?? "";
            await mkdir(checkoutDir, { recursive: true });
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
      }),
    ).rejects.toThrow("No Omniskills workflow manifest was found");

    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("reports missing workflow aliases with the checked examples path", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "workflow-bundle-alias-missing-"));
    let checkoutDir = "";

    await expect(
      loadWorkflowBundle("missing-workflow", {
        tempDir,
        runGitCommand: async (command) => {
          if (command.args[0] === "clone") {
            checkoutDir = command.args.at(-1) ?? "";
            await mkdir(join(checkoutDir, "examples", "workflows"), { recursive: true });
            return { stdout: "", stderr: "", exitCode: 0 };
          }
          return { stdout: "abc123\n", stderr: "", exitCode: 0 };
        },
      }),
    ).rejects.toThrow(
      "Omniskills workflow alias not found: missing-workflow\nChecked: https://github.com/devos-ing/omni-skills.git#examples/workflows/missing-workflow",
    );

    await expect(stat(checkoutDir)).rejects.toThrow();
    await rm(tempDir, { recursive: true, force: true });
  });

  test("prepares a looped workflow entry skill with generated runner files", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-loop-prepare-"));
    const bundleDir = join(rootDir, "looped-workflow");
    const tempDir = join(rootDir, "prepared");
    await mkdir(join(bundleDir, "skills", "looped-workflow"), { recursive: true });
    await writeFile(
      join(bundleDir, "skills", "looped-workflow", "SKILL.md"),
      [
        "---",
        "name: looped-workflow",
        'description: "Loop-enabled entry skill."',
        "---",
        "",
        "# looped-workflow",
      ].join("\n"),
    );
    await writeFile(
      join(bundleDir, "workflow.json"),
      JSON.stringify(
        {
          schemaVersion: "0.1",
          name: "looped-workflow",
          version: "0.1.0",
          description: "Uses a loop runtime.",
          loop: { script: "./loop.mjs", state: "global", execution: "action-only" },
          skills: [{ source: "./skills/looped-workflow", entry: true }, { source: "pony-trail" }],
          steps: [
            { id: "entry", title: "Entry", skill: "./skills/looped-workflow" },
            { id: "evidence", title: "Evidence", skill: "pony-trail" },
          ],
        },
        null,
        2,
      ),
    );

    try {
      const bundle = await loadWorkflowBundle(bundleDir);
      const metadata = createWorkflowLoopMetadata(bundle);

      expect(metadata).toEqual({
        schemaVersion: "0.1",
        workflow: "looped-workflow",
        entrySkill: "./skills/looped-workflow",
        loopScript: "./loop.mjs",
        state: "global",
        execution: "action-only",
        commands: ["start", "status", "log", "advance", "summary"],
      });

      const prepared = await getPreparedWorkflowSkillInstallDependencies({
        bundle,
        tempDir,
      });

      expect(prepared.dependencies).toHaveLength(2);
      expect(prepared.dependencies[0]?.source).toContain("looped-workflow-entry-");
      expect(prepared.dependencies[1]).toEqual({ source: "pony-trail" });
      const preparedEntry = prepared.dependencies[0];
      expect(preparedEntry).toBeDefined();
      await expect(
        readFile(join(preparedEntry?.source ?? "", "SKILL.md"), "utf8"),
      ).resolves.toContain("Loop-enabled entry skill.");
      await expect(
        readFile(join(preparedEntry?.source ?? "", "workflow.json"), "utf8"),
      ).resolves.toContain('"name": "looped-workflow"');
      const generatedRunner = await readFile(join(preparedEntry?.source ?? "", "loop.mjs"), "utf8");
      expect(generatedRunner).toContain("process.env.OMNISKILL_BIN");
      expect(generatedRunner).toContain("omniskill");
      expect(generatedRunner).toContain("workflow.json");
      await expect(
        readFile(join(preparedEntry?.source ?? "", "loop.metadata.json"), "utf8"),
      ).resolves.toContain('"workflow": "looped-workflow"');
      await expect(stat(join(preparedEntry?.source ?? "", "loop-runtime.mjs"))).rejects.toThrow();

      await prepared.cleanup?.();
      await expect(stat(preparedEntry?.source ?? "")).rejects.toThrow();
    } finally {
      await rm(rootDir, { recursive: true, force: true });
    }
  });

  test("does not prepare loop runtime files for non-loop workflows", async () => {
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");
    const prepared = await getPreparedWorkflowSkillInstallDependencies({ bundle });

    try {
      expect(prepared.dependencies.map((dependency) => dependency.source)).toEqual(
        getWorkflowSkillInstallSources(bundle),
      );
      expect(prepared.cleanup).toBeUndefined();
    } finally {
      await prepared.cleanup?.();
    }
  });

  test("installs and lists workflow bundles under .omniskills", async () => {
    const rootDir = await mkdtemp(join(tmpdir(), "workflow-bundle-install-"));
    const bundle = await loadWorkflowBundle("examples/workflows/release-review");

    const installed = await installWorkflowBundle({
      rootDir,
      bundle,
    });

    expect(installed.path).toBe(join(rootDir, ".omniskills", "workflows", "release-review.json"));
    const installedFile = JSON.parse(await readFile(installed.path, "utf8"));
    expect(installedFile.name).toBe("release-review");
    expect(installedFile.steps).toHaveLength(4);

    const workflows = await listInstalledWorkflowBundles({ rootDir });
    expect(workflows.map((workflow) => workflow.name)).toEqual(["release-review"]);
  });
});

async function runGit(args: string[], cwd: string): Promise<void> {
  const subprocess = Bun.spawn(["git", ...args], {
    cwd,
    stdout: "pipe",
    stderr: "pipe",
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(subprocess.stdout).text(),
    new Response(subprocess.stderr).text(),
    subprocess.exited,
  ]);

  if (exitCode !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${stderr.trim() || stdout.trim()}`);
  }
}
