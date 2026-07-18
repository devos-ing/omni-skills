import { describe, expect, test } from "bun:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  executeAgentProfilePlan,
  preflightAgentProfiles,
} from "../src/plugins/agent-profile-installer";
import {
  executeModelRoutingSetup,
  planModelRoutingSetup,
} from "../src/plugins/model-routing-setup";
import {
  type CodexModelCapability,
  createModelRoleOrchestrationConfig,
  DEFAULT_ORCHESTRATION_CONFIG,
  getInstalledWorkflowBundlePath,
  hashAgentProfileContent,
  type InstalledWorkflowBundle,
  LEGACY_DEFAULT_ORCHESTRATION_CONFIG,
  planAgentProfiles,
  type WorkflowInstallArtifact,
} from "../src/runtimes/omniskill";

const catalog = [
  {
    slug: "gpt-5.5",
    visibility: "list",
    priority: 0,
    supportedReasoningEfforts: ["low", "medium", "high"],
  },
] satisfies CodexModelCapability[];

const selections = {
  planning: { model: "gpt-5.5", reasoningEffort: "high" },
  implementation: { model: "gpt-5.5", reasoningEffort: "medium" },
  verification: { model: "gpt-5.5", reasoningEffort: "high" },
} as const;

const roleSkillNames = {
  "./skills/startup-goal": "startup-goal",
  "mattpocock:implement": "implement",
};

function installedWorkflow(artifacts: WorkflowInstallArtifact[]): InstalledWorkflowBundle {
  return {
    schemaVersion: "0.1",
    kind: "team",
    name: "startup-team",
    version: "0.4.0",
    description: "Labeled setup fixture.",
    coordinator: "./skills/startup-goal",
    members: ["mattpocock:implement"],
    orchestration: {
      roles: {
        "./skills/startup-goal": {
          tier: "deep",
          modelRole: "planning",
          access: "read-only",
          consultation: "receive",
        },
        "mattpocock:implement": {
          tier: "standard",
          modelRole: "implementation",
          access: "workspace-write",
          consultation: "request",
        },
      },
    },
    skills: [{ source: "./skills/startup-goal", entry: true }, { source: "mattpocock:implement" }],
    steps: [
      { id: "route", title: "Route", skill: "./skills/startup-goal" },
      {
        id: "implement",
        title: "Implement",
        skill: "mattpocock:implement",
        phase: "implementation",
      },
    ],
    source: { kind: "local", path: "/tmp/startup-team" },
    installArtifacts: artifacts,
  };
}

async function writeInstalledFixture(homeDir: string) {
  const oldConfig = createModelRoleOrchestrationConfig({
    config: DEFAULT_ORCHESTRATION_CONFIG,
    selections: {
      planning: { model: "planner-old", reasoningEffort: "high" },
      implementation: { model: "builder-old", reasoningEffort: "medium" },
      verification: { model: "verifier-old", reasoningEffort: "high" },
    },
  });
  const workflowWithoutArtifacts = installedWorkflow([]);
  const profiles = planAgentProfiles({
    manifest: workflowWithoutArtifacts,
    config: oldConfig,
    homeDir,
    targets: ["codex"],
    roleSkillNames,
  });
  const writes = await preflightAgentProfiles({ profiles, previousArtifacts: [] });
  const profileArtifacts = await executeAgentProfilePlan({ profiles: writes });
  const skillArtifacts: WorkflowInstallArtifact[] = [
    {
      kind: "skill",
      source: "./skills/startup-goal",
      skillName: "startup-goal",
      agent: "codex",
      status: "installed",
      paths: [join(homeDir, ".agents", "skills", "startup-goal")],
    },
    {
      kind: "skill",
      source: "mattpocock:implement",
      skillName: "implement",
      agent: "codex",
      status: "installed",
      paths: [join(homeDir, ".agents", "skills", "implement")],
    },
  ];
  const workflow = {
    ...installedWorkflow([...skillArtifacts, ...profileArtifacts]),
    installedRoleSkillNames: roleSkillNames,
  };
  const recordPath = getInstalledWorkflowBundlePath({
    rootDir: homeDir,
    workflowName: workflow.name,
  });
  await mkdir(join(homeDir, ".omniskills", "workflows"), { recursive: true });
  await writeFile(recordPath, `${JSON.stringify(workflow, null, 2)}\n`);
  const profilePath = profileArtifacts[0]?.path;
  if (!profilePath) throw new Error("Expected profile artifact");
  return {
    recordPath,
    profilePath,
    originalRecord: await readFile(recordPath, "utf8"),
    originalProfile: await readFile(profilePath, "utf8"),
  };
}

describe("model routing setup", () => {
  test("plans a global config, Codex profiles, and workflow record together", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "model-routing-setup-"));
    try {
      await writeInstalledFixture(homeDir);

      const plan = await planModelRoutingSetup({ homeDir, catalog, selections });

      expect(plan.config.config.schemaVersion).toBe("0.2");
      expect(plan.profileWrites).toEqual(
        expect.arrayContaining([expect.objectContaining({ status: "update" })]),
      );
      expect(plan.recordWrites).toEqual([
        expect.objectContaining({ workflowName: "startup-team", status: "update" }),
      ]);
      expect(plan.affectedWorkflows).toEqual(["startup-team"]);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("uses persisted logical role names when install artifacts retain resolved sources", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "model-routing-persisted-role-names-"));
    try {
      await writeInstalledFixture(homeDir);
      const recordPath = getInstalledWorkflowBundlePath({
        rootDir: homeDir,
        workflowName: "startup-team",
      });
      const workflow = JSON.parse(await readFile(recordPath, "utf8")) as InstalledWorkflowBundle;
      const legacyArtifacts = (workflow.installArtifacts ?? []).map((artifact) =>
        artifact.kind === "agent_profile"
          ? artifact
          : { ...artifact, source: `/private/tmp/resolved/${artifact.skillName}` },
      );
      await writeFile(
        recordPath,
        `${JSON.stringify(
          {
            ...workflow,
            installArtifacts: legacyArtifacts,
            installedRoleSkillNames: roleSkillNames,
          },
          null,
          2,
        )}\n`,
      );

      const plan = await planModelRoutingSetup({ homeDir, catalog, selections });

      expect(plan.affectedWorkflows).toEqual(["startup-team"]);
      expect(plan.profileWrites).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            artifact: expect.objectContaining({
              profileId: "omniskills-startup-team-startup-goal",
            }),
          }),
        ]),
      );
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("reconstructs a legacy role mapping only from matching managed profiles and installed artifacts", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "model-routing-legacy-role-names-"));
    try {
      await writeInstalledFixture(homeDir);
      const recordPath = getInstalledWorkflowBundlePath({
        rootDir: homeDir,
        workflowName: "startup-team",
      });
      const workflow = JSON.parse(await readFile(recordPath, "utf8")) as InstalledWorkflowBundle;
      const artifacts = (workflow.installArtifacts ?? []).map((artifact) =>
        artifact.kind === "agent_profile"
          ? artifact
          : { ...artifact, source: `/private/tmp/resolved/${artifact.skillName}` },
      );
      for (const artifact of artifacts) {
        if (artifact.kind === "agent_profile") continue;
        for (const path of artifact.paths) {
          await mkdir(path, { recursive: true });
          await writeFile(join(path, "SKILL.md"), "installed\n");
        }
      }
      delete workflow.installedRoleSkillNames;
      await writeFile(
        recordPath,
        `${JSON.stringify({ ...workflow, installArtifacts: artifacts }, null, 2)}\n`,
      );

      await expect(planModelRoutingSetup({ homeDir, catalog, selections })).resolves.toMatchObject({
        affectedWorkflows: ["startup-team"],
      });
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("gives legacy records without safe role evidence an actionable reinstall command", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "model-routing-legacy-reinstall-"));
    try {
      await writeInstalledFixture(homeDir);
      const recordPath = getInstalledWorkflowBundlePath({
        rootDir: homeDir,
        workflowName: "startup-team",
      });
      const workflow = JSON.parse(await readFile(recordPath, "utf8")) as InstalledWorkflowBundle;
      delete workflow.installedRoleSkillNames;
      await writeFile(
        recordPath,
        `${JSON.stringify(
          {
            ...workflow,
            installArtifacts: (workflow.installArtifacts ?? []).map((artifact) =>
              artifact.kind === "agent_profile"
                ? artifact
                : { ...artifact, source: `/private/tmp/resolved/${artifact.skillName}` },
            ),
          },
          null,
          2,
        )}\n`,
      );

      await expect(planModelRoutingSetup({ homeDir, catalog, selections })).rejects.toThrow(
        "omniskill install startup-team --force",
      );
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("aborts before writes when a managed profile drifted", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "model-routing-conflict-"));
    try {
      const { profilePath, recordPath, originalRecord } = await writeInstalledFixture(homeDir);
      await writeFile(profilePath, "user edit\n");

      await expect(planModelRoutingSetup({ homeDir, catalog, selections })).rejects.toThrow(
        "Agent profile conflict",
      );
      expect(await readFile(recordPath, "utf8")).toBe(originalRecord);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });

  test("rolls back config profiles and records when the last write fails", async () => {
    const homeDir = await mkdtemp(join(tmpdir(), "model-routing-rollback-"));
    try {
      const { profilePath, recordPath, originalProfile, originalRecord } =
        await writeInstalledFixture(homeDir);
      const configPath = join(homeDir, ".omniskills", "orchestration.json");
      const originalConfig = `${JSON.stringify(LEGACY_DEFAULT_ORCHESTRATION_CONFIG, null, 2)}\n`;
      await writeFile(configPath, originalConfig);
      const blockedParent = join(homeDir, "blocked-parent");
      await writeFile(blockedParent, "not a directory\n");
      const plan = await planModelRoutingSetup({ homeDir, catalog, selections });
      const [recordWrite] = plan.recordWrites;
      if (!recordWrite) throw new Error("Expected record write");
      plan.recordWrites[0] = {
        ...recordWrite,
        path: join(blockedParent, "startup-team.json"),
      };

      await expect(executeModelRoutingSetup(plan)).rejects.toThrow();

      expect(await readFile(configPath, "utf8")).toBe(originalConfig);
      expect(hashAgentProfileContent(await readFile(profilePath, "utf8"))).toBe(
        hashAgentProfileContent(originalProfile),
      );
      expect(await readFile(recordPath, "utf8")).toBe(originalRecord);
    } finally {
      await rm(homeDir, { recursive: true, force: true });
    }
  });
});
