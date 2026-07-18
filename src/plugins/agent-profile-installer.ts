import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  type CodexModelCapability,
  createCatalogOrchestrationConfig,
  DEFAULT_ORCHESTRATION_CONFIG,
  hashAgentProfileContent,
  LEGACY_DEFAULT_ORCHESTRATION_CONFIG,
  type OrchestrationConfig,
  OrchestrationConfigSchema,
  orchestrationConfigFileName,
  type PlannedAgentProfile,
  toEffectiveOrchestrationConfig,
  validateCodexOrchestrationConfig,
  type WorkflowInstallAgentProfileArtifact,
} from "../runtimes/omniskill";

export type AgentProfileInstallStatus =
  | "create"
  | "unchanged"
  | "update"
  | "conflict"
  | "remove"
  | "keep";
export type AgentProfileOwnership = "unowned" | "managed" | "foreign";

export type AgentProfileArtifact = WorkflowInstallAgentProfileArtifact;

interface PlannedDesiredAgentProfileWrite {
  profile: PlannedAgentProfile;
  status: "create" | "unchanged" | "update" | "conflict";
  ownership: AgentProfileOwnership;
  artifact: AgentProfileArtifact;
}

interface PlannedObsoleteAgentProfileWrite {
  status: "remove" | "keep";
  ownership: "managed";
  artifact: AgentProfileArtifact;
}

export type PlannedAgentProfileWrite =
  | PlannedDesiredAgentProfileWrite
  | PlannedObsoleteAgentProfileWrite;

export interface PlannedWorkflowRecordWrite {
  workflowName: string;
  path: string;
  status: "unchanged" | "update";
  content: string;
}

export async function loadOrchestrationConfigPlan(input: {
  homeDir: string;
  codexCatalog?: readonly CodexModelCapability[];
}): Promise<{
  path: string;
  status: "create" | "update" | "unchanged";
  config: OrchestrationConfig;
  content: string;
}> {
  const path = join(input.homeDir, ".omniskills", orchestrationConfigFileName);
  const legacyContent = `${JSON.stringify(LEGACY_DEFAULT_ORCHESTRATION_CONFIG, null, 2)}\n`;
  const generatedConfig = input.codexCatalog
    ? createCatalogOrchestrationConfig(input.codexCatalog)
    : DEFAULT_ORCHESTRATION_CONFIG;
  const generatedContent = `${JSON.stringify(generatedConfig, null, 2)}\n`;
  if (!existsSync(path)) {
    return {
      path,
      status: "create",
      config: generatedConfig,
      content: generatedContent,
    };
  }
  const content = await readFile(path, "utf8");
  if (input.codexCatalog && content === legacyContent) {
    return {
      path,
      status: "update",
      config: generatedConfig,
      content: generatedContent,
    };
  }
  const config = OrchestrationConfigSchema.parse(JSON.parse(content) as unknown);
  const effectiveConfig = toEffectiveOrchestrationConfig(config);
  if (input.codexCatalog) {
    validateCodexOrchestrationConfig(effectiveConfig, input.codexCatalog);
  }
  return {
    path,
    status: "unchanged",
    config: effectiveConfig,
    content,
  };
}

export async function preflightAgentProfiles(input: {
  profiles: PlannedAgentProfile[];
  previousArtifacts: AgentProfileArtifact[];
  force?: boolean;
}): Promise<PlannedAgentProfileWrite[]> {
  const previousByPath = new Map(
    input.previousArtifacts.map((artifact) => [artifact.path, artifact]),
  );
  const writes: PlannedAgentProfileWrite[] = [];
  const desiredPaths = new Set(input.profiles.map((profile) => profile.destination));

  for (const artifact of input.previousArtifacts) {
    if (desiredPaths.has(artifact.path)) continue;
    const status =
      !existsSync(artifact.path) ||
      hashAgentProfileContent(await readFile(artifact.path, "utf8")) === artifact.contentHash
        ? "remove"
        : "keep";
    writes.push({ status, ownership: "managed", artifact });
  }

  for (const profile of input.profiles) {
    const previous = previousByPath.get(profile.destination);
    const exists = existsSync(profile.destination);
    const ownership: AgentProfileOwnership = previous ? "managed" : exists ? "foreign" : "unowned";
    let status: AgentProfileInstallStatus;
    if (!exists) {
      status = "create";
    } else {
      const actualHash = hashAgentProfileContent(await readFile(profile.destination, "utf8"));
      if (!previous) {
        status = "conflict";
      } else if (actualHash !== previous.contentHash) {
        status = input.force ? "update" : "conflict";
      } else {
        status = actualHash === profile.contentHash ? "unchanged" : "update";
      }
    }
    writes.push({
      profile,
      status: status as PlannedDesiredAgentProfileWrite["status"],
      ownership,
      artifact: {
        kind: "agent_profile",
        source: profile.source,
        profileId: profile.profileId,
        agent: profile.target,
        status:
          status === "update" ? "updated" : status === "unchanged" ? "unchanged" : "installed",
        path: profile.destination,
        contentHash: profile.contentHash,
        taskClass: profile.taskClass,
        tier: profile.tier,
        ...(profile.modelRole ? { modelRole: profile.modelRole } : {}),
        model: profile.model,
        effort: profile.effort,
        access: profile.access,
        instructions: profile.instructions,
        consultation: profile.consultation,
        limits: profile.limits,
        candidateIndex: profile.candidateIndex,
        candidateCount: profile.candidateCount,
      },
    });
  }
  return writes;
}

export async function executeAgentProfilePlan(input: {
  profiles: PlannedAgentProfileWrite[];
  config?: { path: string; status: "create" | "update" | "unchanged"; content: string };
  records?: PlannedWorkflowRecordWrite[];
}): Promise<AgentProfileArtifact[]> {
  const conflict = input.profiles.find(({ status }) => status === "conflict");
  if (conflict) {
    throw new Error(`Agent profile conflict: ${conflict.artifact.path}`);
  }

  const changed: Array<{ path: string; previous: string | null }> = [];
  try {
    if (input.config && input.config.status !== "unchanged") {
      const previous = existsSync(input.config.path)
        ? await readFile(input.config.path, "utf8")
        : null;
      await mkdir(dirname(input.config.path), { recursive: true });
      const temporary = `${input.config.path}.omniskills-tmp`;
      await writeFile(temporary, input.config.content);
      await rename(temporary, input.config.path);
      changed.push({ path: input.config.path, previous });
    }

    for (const planned of input.profiles) {
      if (planned.status === "unchanged" || planned.status === "keep") continue;
      const destination = planned.artifact.path;
      const previous = existsSync(destination) ? await readFile(destination, "utf8") : null;
      if (planned.status === "remove") {
        await rm(destination, { force: true });
        changed.push({ path: destination, previous });
        continue;
      }
      if (!("profile" in planned)) continue;
      await mkdir(dirname(destination), { recursive: true });
      const temporary = `${destination}.omniskills-tmp`;
      await writeFile(temporary, planned.profile.content);
      await rename(temporary, destination);
      changed.push({ path: destination, previous });
    }

    for (const record of input.records ?? []) {
      if (record.status === "unchanged") continue;
      const previous = existsSync(record.path) ? await readFile(record.path, "utf8") : null;
      await mkdir(dirname(record.path), { recursive: true });
      const temporary = `${record.path}.omniskills-tmp`;
      await writeFile(temporary, record.content);
      await rename(temporary, record.path);
      changed.push({ path: record.path, previous });
    }
  } catch (error) {
    for (const entry of changed.reverse()) {
      if (entry.previous === null) {
        await rm(entry.path, { force: true });
      } else {
        await mkdir(dirname(entry.path), { recursive: true });
        await writeFile(entry.path, entry.previous);
      }
    }
    throw error;
  }

  return input.profiles.filter(({ status }) => status !== "remove").map(({ artifact }) => artifact);
}
