import { existsSync } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  DEFAULT_ORCHESTRATION_CONFIG,
  hashAgentProfileContent,
  type OrchestrationConfig,
  OrchestrationConfigSchema,
  orchestrationConfigFileName,
  type PlannedAgentProfile,
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

export async function loadOrchestrationConfigPlan(input: { homeDir: string }): Promise<{
  path: string;
  status: "create" | "unchanged";
  config: OrchestrationConfig;
  content: string;
}> {
  const path = join(input.homeDir, ".omniskills", orchestrationConfigFileName);
  if (!existsSync(path)) {
    const content = `${JSON.stringify(DEFAULT_ORCHESTRATION_CONFIG, null, 2)}\n`;
    return { path, status: "create", config: DEFAULT_ORCHESTRATION_CONFIG, content };
  }
  const content = await readFile(path, "utf8");
  return {
    path,
    status: "unchanged",
    config: OrchestrationConfigSchema.parse(JSON.parse(content)),
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
  config?: { path: string; status: "create" | "unchanged"; content: string };
}): Promise<AgentProfileArtifact[]> {
  const conflict = input.profiles.find(({ status }) => status === "conflict");
  if (conflict) {
    throw new Error(`Agent profile conflict: ${conflict.artifact.path}`);
  }

  const changed: Array<{ path: string; previous: string | null }> = [];
  try {
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

    if (input.config?.status === "create") {
      await mkdir(dirname(input.config.path), { recursive: true });
      const temporary = `${input.config.path}.omniskills-tmp`;
      await writeFile(temporary, input.config.content);
      await rename(temporary, input.config.path);
      changed.push({ path: input.config.path, previous: null });
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
