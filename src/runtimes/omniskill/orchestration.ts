import { createHash } from "node:crypto";
import { basename, join } from "node:path";
import { z } from "zod";
import type { WorkflowBundleManifest } from "./workflow-bundles";

export const orchestrationConfigFileName = "orchestration.json";
export const orchestrationTiers = ["deep", "standard", "fast"] as const;
export type OrchestrationTier = (typeof orchestrationTiers)[number];
export type AgentProfileTarget = "codex" | "claude";

const CodexCandidateSchema = z.object({
  model: z.string().min(1),
  reasoningEffort: z.enum(["none", "minimal", "low", "medium", "high", "xhigh", "max", "ultra"]),
});
const ClaudeCandidateSchema = z.object({
  model: z.string().min(1),
  effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
});
const TierCandidatesSchema = z.object({
  codex: z.array(CodexCandidateSchema).min(1),
  claude: z.array(ClaudeCandidateSchema).min(1),
});

export const OrchestrationConfigSchema = z
  .object({
    schemaVersion: z.literal("0.1"),
    tiers: z.object({
      deep: TierCandidatesSchema,
      standard: TierCandidatesSchema,
      fast: TierCandidatesSchema,
    }),
    limits: z.object({
      retryPerCandidate: z.number().int().min(1).max(3),
      reassignmentPerWorkItem: z.number().int().min(1).max(3),
      consultationsPerAgent: z.number().int().min(1).max(5),
    }),
    policy: z.object({
      sameTierFallback: z.literal("automatic_disclosed"),
      lowerTierFallback: z.literal("human_approval"),
    }),
  })
  .superRefine((config, context) => {
    for (const tier of orchestrationTiers) {
      for (const target of ["codex", "claude"] as const) {
        const seen = new Set<string>();
        for (const [index, candidate] of config.tiers[tier][target].entries()) {
          const effort =
            "reasoningEffort" in candidate ? candidate.reasoningEffort : candidate.effort;
          const identity = `${candidate.model}/${effort}`;
          if (seen.has(identity)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate ${tier} ${target} orchestration candidate: ${identity}`,
              path: ["tiers", tier, target, index],
            });
          }
          seen.add(identity);
        }
      }
    }
  });

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;

export const DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  schemaVersion: "0.1",
  tiers: {
    deep: {
      codex: [{ model: "gpt-5.6", reasoningEffort: "high" }],
      claude: [{ model: "opus", effort: "high" }],
    },
    standard: {
      codex: [{ model: "gpt-5.6", reasoningEffort: "medium" }],
      claude: [{ model: "sonnet", effort: "medium" }],
    },
    fast: {
      codex: [{ model: "gpt-5.6-terra", reasoningEffort: "low" }],
      claude: [{ model: "haiku", effort: "low" }],
    },
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
};

export interface PlannedAgentProfile {
  source: string;
  profileId: string;
  target: AgentProfileTarget;
  tier: OrchestrationTier;
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  candidateIndex: number;
  destination: string;
  content: string;
  contentHash: string;
}

function sourceId(source: string): string {
  if (source.startsWith("catalog:")) return source.slice("catalog:".length);
  if (source.includes(":")) return source.slice(source.indexOf(":") + 1);
  return basename(source);
}

function instructions(input: {
  team: string;
  source: string;
  tier: OrchestrationTier;
  consultation: "receive" | "request" | "none";
  limits: OrchestrationConfig["limits"];
}): string {
  return [
    `You are the ${input.source} agent for the ${input.team} Omniskills team.`,
    `Capability tier: ${input.tier}. Stay within the assigned runtime vendor.`,
    `Retry each model candidate at most ${input.limits.retryPerCandidate} time(s).`,
    `Reassign a work item at most ${input.limits.reassignmentPerWorkItem} time(s).`,
    `Consult at most ${input.limits.consultationsPerAgent} time(s), only for ambiguity, requirement_conflict, elevated_risk, or failed_verification.`,
    "A consultation must include trigger, current_task, evidence, decision_needed, and recommendation.",
    "Reject a repeated consultation without new evidence and escalate when the consultation limit is exhausted.",
    "Use an ordered same-tier fallback only after an observed failure, and disclose the failed candidate and reason.",
    "Never expand scope, bypass an approval gate, change permissions, or downgrade a tier without human approval.",
    `Consultation mode: ${input.consultation}.`,
  ].join("\n");
}

function renderCodex(input: {
  profileId: string;
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  developerInstructions: string;
}): string {
  return [
    `name = ${JSON.stringify(input.profileId)}`,
    `description = ${JSON.stringify(`Omniskills managed agent ${input.profileId}`)}`,
    `model = ${JSON.stringify(input.model)}`,
    `model_reasoning_effort = ${JSON.stringify(input.effort)}`,
    `sandbox_mode = ${JSON.stringify(input.access)}`,
    `developer_instructions = ${JSON.stringify(input.developerInstructions)}`,
    "",
  ].join("\n");
}

function renderClaude(input: {
  profileId: string;
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  developerInstructions: string;
}): string {
  const tools =
    input.access === "workspace-write"
      ? "Read, Glob, Grep, Bash, Write, Edit, SendMessage"
      : "Read, Glob, Grep, Bash, SendMessage";
  return [
    "---",
    `name: ${input.profileId}`,
    `description: Omniskills managed agent ${input.profileId}`,
    `model: ${input.model}`,
    `effort: ${input.effort}`,
    `tools: ${tools}`,
    "disallowedTools: Agent",
    "---",
    "",
    input.developerInstructions,
    "",
  ].join("\n");
}

export function planAgentProfiles(input: {
  manifest: WorkflowBundleManifest;
  config: OrchestrationConfig;
  homeDir: string;
  targets: AgentProfileTarget[];
}): PlannedAgentProfile[] {
  if (!input.manifest.orchestration) return [];
  const assignments = [
    ...Object.entries(input.manifest.orchestration.roles).map(([source, assignment]) => ({
      source,
      assignment,
    })),
    ...Object.entries(input.manifest.orchestration.support ?? {}).map(([source, assignment]) => ({
      source,
      assignment,
    })),
  ];
  const profiles: PlannedAgentProfile[] = [];

  for (const { source, assignment } of assignments) {
    for (const target of input.targets) {
      const candidates = input.config.tiers[assignment.tier][target];
      for (const [candidateIndex, candidate] of candidates.entries()) {
        const baseId = `omniskills-${input.manifest.name}-${sourceId(source)}`;
        const profileId =
          candidateIndex === 0 ? baseId : `${baseId}-fallback-${candidateIndex + 1}`;
        const developerInstructions = instructions({
          team: input.manifest.name,
          source,
          tier: assignment.tier,
          consultation: assignment.consultation,
          limits: input.config.limits,
        });
        const model = candidate.model;
        const effort =
          "reasoningEffort" in candidate ? candidate.reasoningEffort : candidate.effort;
        const content =
          target === "codex"
            ? renderCodex({
                profileId,
                model,
                effort,
                access: assignment.access,
                developerInstructions,
              })
            : renderClaude({
                profileId,
                model,
                effort,
                access: assignment.access,
                developerInstructions,
              });
        const extension = target === "codex" ? "toml" : "md";
        profiles.push({
          source,
          profileId,
          target,
          tier: assignment.tier,
          model,
          effort,
          access: assignment.access,
          candidateIndex,
          destination: join(input.homeDir, `.${target}`, "agents", `${profileId}.${extension}`),
          content,
          contentHash: `sha256:${createHash("sha256").update(content).digest("hex")}`,
        });
      }
    }
  }

  return profiles.sort((left, right) => {
    const leftBaseId = left.profileId.replace(/-fallback-\d+$/, "");
    const rightBaseId = right.profileId.replace(/-fallback-\d+$/, "");
    const groupOrder = `${leftBaseId}:${left.target}`.localeCompare(
      `${rightBaseId}:${right.target}`,
    );
    return groupOrder || left.candidateIndex - right.candidateIndex;
  });
}
