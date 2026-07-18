import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import {
  CodexCandidateSchema,
  type CodexModelCapability,
  createModelRoleOrchestrationConfig,
  getInstalledWorkflowBundlePath,
  type InstalledWorkflowBundle,
  listInstalledWorkflowBundles,
  planAgentProfiles,
  validateCodexOrchestrationConfig,
  type WorkflowInstallAgentProfileArtifact,
  type WorkflowInstallSkillArtifact,
} from "../runtimes/omniskill";
import {
  executeAgentProfilePlan,
  loadOrchestrationConfigPlan,
  type PlannedAgentProfileWrite,
  type PlannedWorkflowRecordWrite,
  preflightAgentProfiles,
} from "./agent-profile-installer";

export const ModelRoutingSelectionsSchema = z
  .object({
    planning: CodexCandidateSchema,
    implementation: CodexCandidateSchema,
    verification: CodexCandidateSchema,
  })
  .strict();

export type ModelRoutingSelections = z.infer<typeof ModelRoutingSelectionsSchema>;

export interface ModelRoutingSetupPlan {
  config: Awaited<ReturnType<typeof loadOrchestrationConfigPlan>>;
  profileWrites: PlannedAgentProfileWrite[];
  recordWrites: PlannedWorkflowRecordWrite[];
  affectedWorkflows: string[];
}

function isSkillArtifact(artifact: { kind?: string }): artifact is WorkflowInstallSkillArtifact {
  return artifact.kind !== "agent_profile";
}

function legacyRoleMappingRepairCommand(workflowName: string): string {
  return `omniskill install ${workflowName} --force`;
}

async function installedRoleSkillNames(input: {
  workflow: InstalledWorkflowBundle;
}): Promise<Record<string, string>> {
  const roleSources = Object.keys(input.workflow.orchestration?.roles ?? {});
  const mappings = { ...(input.workflow.installedRoleSkillNames ?? {}) };
  const missing = roleSources.filter((source) => !mappings[source]);
  if (missing.length === 0) return mappings;

  const artifacts = input.workflow.installArtifacts ?? [];
  const skillArtifacts = artifacts
    .filter(isSkillArtifact)
    .filter((artifact) => artifact.agent === "codex");
  const profiles = artifacts
    .filter(isCodexProfileArtifact)
    .filter((artifact) => artifact.taskClass === "role");

  for (const source of missing) {
    const matchingProfiles = profiles.filter((artifact) => artifact.source === source);
    const profile = matchingProfiles.length === 1 ? matchingProfiles[0] : undefined;
    const profileInstructions = profile?.instructions;
    const name = profileInstructions?.match(/installed `\$([a-z0-9]+(?:-[a-z0-9]+)*)` skill/)?.[1];
    const matchingSkills = name
      ? skillArtifacts.filter(
          (artifact) =>
            artifact.skillName === name && artifact.paths.some((path) => existsSync(path)),
        )
      : [];
    if (!profile || !name || matchingSkills.length !== 1) {
      throw new Error(
        `Cannot safely reconstruct installed role skill names for legacy workflow ${input.workflow.name}. Reinstall or upgrade with: ${legacyRoleMappingRepairCommand(input.workflow.name)}`,
      );
    }
    mappings[source] = name;
  }

  return mappings;
}

function isCodexProfileArtifact(
  artifact: NonNullable<InstalledWorkflowBundle["installArtifacts"]>[number],
): artifact is WorkflowInstallAgentProfileArtifact {
  return artifact.kind === "agent_profile" && artifact.agent === "codex";
}

export async function planModelRoutingSetup(input: {
  homeDir: string;
  catalog: readonly CodexModelCapability[];
  selections: ModelRoutingSelections;
}): Promise<ModelRoutingSetupPlan> {
  const selections = ModelRoutingSelectionsSchema.parse(input.selections);
  const current = await loadOrchestrationConfigPlan({
    homeDir: input.homeDir,
    codexCatalog: input.catalog,
  });
  const nextConfig = createModelRoleOrchestrationConfig({
    config: current.config,
    selections,
  });
  validateCodexOrchestrationConfig(nextConfig, input.catalog);
  const nextContent = `${JSON.stringify(nextConfig, null, 2)}\n`;
  const config = {
    path: current.path,
    status: current.content === nextContent ? ("unchanged" as const) : ("update" as const),
    config: nextConfig,
    content: nextContent,
  };

  const profileWrites: PlannedAgentProfileWrite[] = [];
  const recordWrites: PlannedWorkflowRecordWrite[] = [];
  const affectedWorkflows: string[] = [];
  for (const workflow of await listInstalledWorkflowBundles({ rootDir: input.homeDir })) {
    const assignments = [
      ...Object.values(workflow.orchestration?.roles ?? {}),
      ...Object.values(workflow.orchestration?.support ?? {}),
    ];
    if (!assignments.some(({ modelRole }) => modelRole !== undefined)) continue;

    const roleSkillNames = await installedRoleSkillNames({ workflow });
    const plannedProfiles = planAgentProfiles({
      manifest: workflow,
      config: nextConfig,
      homeDir: input.homeDir,
      targets: ["codex"],
      roleSkillNames,
    });
    const previousCodexArtifacts = (workflow.installArtifacts ?? []).filter(isCodexProfileArtifact);
    const writes = await preflightAgentProfiles({
      profiles: plannedProfiles,
      previousArtifacts: previousCodexArtifacts,
    });
    const conflict = writes.find(({ status }) => status === "conflict");
    if (conflict) throw new Error(`Agent profile conflict: ${conflict.artifact.path}`);

    profileWrites.push(...writes);
    const nextCodexArtifacts = writes
      .filter(({ status }) => status !== "remove")
      .map(({ artifact }) => artifact);
    const preservedArtifacts = (workflow.installArtifacts ?? []).filter(
      (artifact) => !isCodexProfileArtifact(artifact),
    );
    const nextWorkflow: InstalledWorkflowBundle = {
      ...workflow,
      installedRoleSkillNames: roleSkillNames,
      installArtifacts: [...preservedArtifacts, ...nextCodexArtifacts],
    };
    const path = getInstalledWorkflowBundlePath({
      rootDir: input.homeDir,
      workflowName: workflow.name,
    });
    const content = `${JSON.stringify(nextWorkflow, null, 2)}\n`;
    const previousContent = await readFile(path, "utf8");
    recordWrites.push({
      workflowName: workflow.name,
      path,
      status: previousContent === content ? "unchanged" : "update",
      content,
    });
    affectedWorkflows.push(workflow.name);
  }

  return { config, profileWrites, recordWrites, affectedWorkflows };
}

export async function executeModelRoutingSetup(plan: ModelRoutingSetupPlan): Promise<void> {
  await executeAgentProfilePlan({
    profiles: plan.profileWrites,
    config: plan.config,
    records: plan.recordWrites,
  });
}
