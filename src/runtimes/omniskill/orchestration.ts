import { createHash } from "node:crypto";
import { basename, resolve, sep } from "node:path";
import { z } from "zod";
import type { ModelRole, WorkflowBundleManifest } from "./workflow-bundles";

export const orchestrationConfigFileName = "orchestration.json";
export const orchestrationTiers = ["deep", "standard", "fast"] as const;
export type OrchestrationTier = (typeof orchestrationTiers)[number];
export type AgentProfileTarget = "codex" | "claude";

export const CodexReasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
]);

export interface CodexModelCapability {
  slug: string;
  visibility: string;
  priority: number;
  supportedReasoningEfforts: readonly z.infer<typeof CodexReasoningEffortSchema>[];
}

export type OrchestrationModelCompatibilityErrorCode =
  | "tier_effort_unavailable"
  | "model_unavailable"
  | "effort_unsupported";

export class OrchestrationModelCompatibilityError extends Error {
  constructor(
    public readonly code: OrchestrationModelCompatibilityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrchestrationModelCompatibilityError";
  }
}

export const CodexCandidateSchema = z
  .object({
    model: z.string().min(1),
    reasoningEffort: CodexReasoningEffortSchema,
  })
  .strict();
const ClaudeCandidateSchema = z
  .object({
    model: z
      .string()
      .regex(/^[A-Za-z0-9][A-Za-z0-9._-]*$/, "Claude model must be a safe model identifier"),
    effort: z.enum(["low", "medium", "high", "xhigh", "max"]),
  })
  .strict();
const TierCandidatesSchema = z
  .object({
    codex: z.array(CodexCandidateSchema).min(1),
    claude: z.array(ClaudeCandidateSchema).min(1),
  })
  .strict();

const ModelRoleCandidatesSchema = z
  .object({
    codex: z.array(CodexCandidateSchema).min(1),
  })
  .strict();

const OrchestrationConfigCoreSchema = z
  .object({
    tiers: z
      .object({
        deep: TierCandidatesSchema,
        standard: TierCandidatesSchema,
        fast: TierCandidatesSchema,
      })
      .strict(),
    limits: z
      .object({
        retryPerCandidate: z.number().int().min(1).max(3),
        reassignmentPerWorkItem: z.number().int().min(1).max(3),
        consultationsPerAgent: z.number().int().min(1).max(5),
      })
      .strict(),
    policy: z
      .object({
        sameTierFallback: z.literal("automatic_disclosed"),
        lowerTierFallback: z.literal("human_approval"),
      })
      .strict(),
  })
  .strict();

export const OrchestrationConfigV1Schema = OrchestrationConfigCoreSchema.extend({
  schemaVersion: z.literal("0.1"),
}).strict();

export const OrchestrationConfigV2Schema = OrchestrationConfigCoreSchema.extend({
  schemaVersion: z.literal("0.2"),
  modelRoles: z
    .object({
      planning: ModelRoleCandidatesSchema,
      implementation: ModelRoleCandidatesSchema,
      verification: ModelRoleCandidatesSchema,
    })
    .strict(),
}).strict();

export const OrchestrationConfigSchema = z
  .union([OrchestrationConfigV1Schema, OrchestrationConfigV2Schema])
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
    if (config.schemaVersion === "0.2") {
      for (const role of ["planning", "implementation", "verification"] as const) {
        const seen = new Set<string>();
        for (const [index, candidate] of config.modelRoles[role].codex.entries()) {
          const identity = `${candidate.model}/${candidate.reasoningEffort}`;
          if (seen.has(identity)) {
            context.addIssue({
              code: z.ZodIssueCode.custom,
              message: `Duplicate ${role} codex model-role candidate: ${identity}`,
              path: ["modelRoles", role, "codex", index],
            });
          }
          seen.add(identity);
        }
      }
    }
  });

export type OrchestrationConfig = z.infer<typeof OrchestrationConfigSchema>;
export type EffectiveOrchestrationConfig = z.infer<typeof OrchestrationConfigV2Schema>;

const defaultCodexModels = {
  deep: "gpt-5.6-sol",
  standard: "gpt-5.6-sol",
  fast: "gpt-5.6-terra",
} as const satisfies Record<OrchestrationTier, string>;

export const LEGACY_DEFAULT_ORCHESTRATION_CONFIG: OrchestrationConfig = {
  schemaVersion: "0.1",
  tiers: {
    deep: {
      codex: [{ model: defaultCodexModels.deep, reasoningEffort: "high" }],
      claude: [{ model: "opus", effort: "high" }],
    },
    standard: {
      codex: [{ model: defaultCodexModels.standard, reasoningEffort: "medium" }],
      claude: [{ model: "sonnet", effort: "medium" }],
    },
    fast: {
      codex: [{ model: defaultCodexModels.fast, reasoningEffort: "low" }],
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

export function toEffectiveOrchestrationConfig(
  input: OrchestrationConfig,
): EffectiveOrchestrationConfig {
  const config = OrchestrationConfigSchema.parse(input);
  if (config.schemaVersion === "0.2") return config;
  return OrchestrationConfigV2Schema.parse({
    ...config,
    schemaVersion: "0.2",
    modelRoles: {
      planning: { codex: config.tiers.deep.codex },
      implementation: { codex: config.tiers.standard.codex },
      verification: { codex: config.tiers.deep.codex },
    },
  });
}

export const DEFAULT_ORCHESTRATION_CONFIG: EffectiveOrchestrationConfig =
  toEffectiveOrchestrationConfig(LEGACY_DEFAULT_ORCHESTRATION_CONFIG);

export function createModelRoleOrchestrationConfig(input: {
  config: OrchestrationConfig;
  selections: Record<ModelRole, z.infer<typeof CodexCandidateSchema>>;
}): EffectiveOrchestrationConfig {
  const effective = toEffectiveOrchestrationConfig(input.config);
  return OrchestrationConfigV2Schema.parse({
    ...effective,
    modelRoles: {
      planning: { codex: [input.selections.planning] },
      implementation: { codex: [input.selections.implementation] },
      verification: { codex: [input.selections.verification] },
    },
  });
}

const codexTierEffort = {
  deep: "high",
  standard: "medium",
  fast: "low",
} as const;

function selectCodexModel(
  tier: OrchestrationTier,
  catalog: readonly CodexModelCapability[],
): { model: string; reasoningEffort: z.infer<typeof CodexReasoningEffortSchema> } {
  const reasoningEffort = codexTierEffort[tier];
  const selected = catalog
    .filter(
      (model) =>
        model.visibility === "list" && model.supportedReasoningEfforts.includes(reasoningEffort),
    )
    .sort(
      (left, right) =>
        Number(left.slug !== defaultCodexModels[tier]) -
          Number(right.slug !== defaultCodexModels[tier]) ||
        left.priority - right.priority ||
        left.slug.localeCompare(right.slug),
    )[0];
  if (!selected) {
    throw new OrchestrationModelCompatibilityError(
      "tier_effort_unavailable",
      `${tier} requires Codex effort ${reasoningEffort}, but no visible model supports it. Update Codex or authenticate the intended identity.`,
    );
  }
  return { model: selected.slug, reasoningEffort };
}

export function createCatalogOrchestrationConfig(
  catalog: readonly CodexModelCapability[],
): EffectiveOrchestrationConfig {
  return OrchestrationConfigSchema.parse({
    ...DEFAULT_ORCHESTRATION_CONFIG,
    tiers: Object.fromEntries(
      orchestrationTiers.map((tier) => [
        tier,
        {
          codex: [selectCodexModel(tier, catalog)],
          claude: DEFAULT_ORCHESTRATION_CONFIG.tiers[tier].claude,
        },
      ]),
    ),
    modelRoles: {
      planning: { codex: [selectCodexModel("deep", catalog)] },
      implementation: { codex: [selectCodexModel("standard", catalog)] },
      verification: { codex: [selectCodexModel("deep", catalog)] },
    },
  }) as EffectiveOrchestrationConfig;
}

export function validateCodexOrchestrationConfig(
  config: OrchestrationConfig,
  catalog: readonly CodexModelCapability[],
): void {
  const effective = toEffectiveOrchestrationConfig(config);
  const visibleBySlug = new Map(
    catalog.filter(({ visibility }) => visibility === "list").map((model) => [model.slug, model]),
  );
  const candidateGroups = [
    ...orchestrationTiers.map((tier) => [`${tier} Codex`, effective.tiers[tier].codex] as const),
    ...(["planning", "implementation", "verification"] as const).map(
      (role) => [`${role} model-role`, effective.modelRoles[role].codex] as const,
    ),
  ];
  for (const [label, candidates] of candidateGroups) {
    for (const candidate of candidates) {
      const model = visibleBySlug.get(candidate.model);
      if (!model) {
        throw new OrchestrationModelCompatibilityError(
          "model_unavailable",
          `${label} model ${candidate.model} is unavailable. Edit the custom orchestration configuration or authenticate the intended identity.`,
        );
      }
      if (!model.supportedReasoningEfforts.includes(candidate.reasoningEffort)) {
        throw new OrchestrationModelCompatibilityError(
          "effort_unsupported",
          `${label} model ${candidate.model} does not support effort ${candidate.reasoningEffort}. Edit the custom orchestration configuration.`,
        );
      }
    }
  }
}

export interface PlannedAgentProfile {
  source: string;
  taskClass: "role" | "support";
  profileId: string;
  target: AgentProfileTarget;
  tier: OrchestrationTier;
  modelRole?: ModelRole;
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  instructions: string;
  consultation: "receive" | "request" | "none";
  limits: OrchestrationConfig["limits"];
  candidateIndex: number;
  candidateCount: number;
  destination: string;
  content: string;
  contentHash: string;
}

export function hashAgentProfileContent(content: string): string {
  return `sha256:${createHash("sha256").update(content).digest("hex")}`;
}

function sourceId(source: string): string {
  if (source.startsWith("catalog:")) return source.slice("catalog:".length);
  if (source.includes(":")) return source.slice(source.indexOf(":") + 1);
  return basename(source);
}

const profileIdentityPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function assertSafeProfileIdentity(component: string): void {
  if (!profileIdentityPattern.test(component)) {
    throw new Error(`Unsafe agent profile identifier component: ${component}`);
  }
}

function instructions(input: {
  team: string;
  source: string;
  taskClass: "role" | "support";
  skillName: string | undefined;
  tier: OrchestrationTier;
  modelRole?: ModelRole;
  access: "read-only" | "workspace-write";
  consultation: "receive" | "request" | "none";
  limits: OrchestrationConfig["limits"];
}): string {
  return [
    `You are the ${input.source} agent for the ${input.team} Omniskills team.`,
    input.taskClass === "role"
      ? `Before acting, load and follow the installed \`$${input.skillName}\` skill.`
      : "This is a support task class with no installed role skill.",
    input.access === "workspace-write"
      ? "Workspace-write tools are authorized only while executing an explicitly assigned implementation step."
      : "Operate read-only; do not create, edit, move, or delete workspace files.",
    `Capability tier: ${input.tier}. Stay within the assigned runtime vendor.`,
    ...(input.modelRole ? [`Model role: ${input.modelRole}.`] : []),
    `Retry each model candidate at most ${input.limits.retryPerCandidate} time(s).`,
    `Reassign a work item at most ${input.limits.reassignmentPerWorkItem} time(s).`,
    `Consult at most ${input.limits.consultationsPerAgent} time(s), only for ambiguity, requirement_conflict, elevated_risk, or failed_verification.`,
    "A consultation must include trigger, current_task, evidence, decision_needed, and recommendation.",
    "When native messaging is unavailable, return the same structured consultation request as your result and stop; do not continue the blocked task.",
    "Reject a repeated consultation without new evidence and escalate when the consultation limit is exhausted.",
    "Use an ordered same-tier fallback only after an observed failure, and disclose the failed candidate and reason.",
    "Never expand scope, bypass an approval gate, change permissions, or downgrade a tier without human approval.",
    `Consultation mode: ${input.consultation}.`,
  ].join("\n");
}

function assignmentCandidates(input: {
  config: EffectiveOrchestrationConfig;
  assignment: {
    tier: OrchestrationTier;
    modelRole?: ModelRole;
  };
  target: AgentProfileTarget;
}) {
  if (input.target === "codex" && input.assignment.modelRole) {
    return input.config.modelRoles[input.assignment.modelRole].codex;
  }
  return input.config.tiers[input.assignment.tier][input.target];
}

function renderCodex(input: {
  profileId: string;
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  developerInstructions: string;
  ownershipMarker: string;
}): string {
  return [
    `# ${input.ownershipMarker}`,
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
  consultation: "receive" | "request" | "none";
  ownershipMarker: string;
}): string {
  const tools = [
    "Read",
    "Glob",
    "Grep",
    ...(input.access === "workspace-write" ? ["Bash", "Write", "Edit"] : []),
    ...(input.consultation === "none" ? [] : ["SendMessage"]),
  ].join(", ");
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
    `<!-- ${input.ownershipMarker} -->`,
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
  roleSkillNames: Record<string, string>;
}): PlannedAgentProfile[] {
  if (!input.manifest.orchestration) return [];
  const config = toEffectiveOrchestrationConfig(input.config);
  assertSafeProfileIdentity(input.manifest.name);
  const assignments = [
    ...Object.entries(input.manifest.orchestration.roles).map(([source, assignment]) => ({
      source,
      assignment,
      taskClass: "role" as const,
      skillName: input.roleSkillNames[source],
    })),
    ...Object.entries(input.manifest.orchestration.support ?? {}).map(([source, assignment]) => ({
      source,
      assignment,
      taskClass: "support" as const,
      skillName: undefined,
    })),
  ];
  const profiles: PlannedAgentProfile[] = [];

  const profileIds = new Set<string>();
  for (const { source } of assignments) {
    const identity = sourceId(source);
    assertSafeProfileIdentity(identity);
    const profileId = `omniskills-${input.manifest.name}-${identity}`;
    if (profileIds.has(profileId)) {
      throw new Error(`Duplicate agent profile identifier: ${profileId}`);
    }
    profileIds.add(profileId);
  }

  for (const { source, assignment, taskClass, skillName } of assignments) {
    if (taskClass === "role" && !skillName) {
      throw new Error(`Missing installed role skill name: ${source}`);
    }
    if (skillName) assertSafeProfileIdentity(skillName);
    for (const target of input.targets) {
      const modelRole = target === "codex" ? assignment.modelRole : undefined;
      const candidates = assignmentCandidates({
        config,
        assignment: {
          tier: assignment.tier,
          ...(modelRole ? { modelRole } : {}),
        },
        target,
      });
      for (const [candidateIndex, candidate] of candidates.entries()) {
        const baseId = `omniskills-${input.manifest.name}-${sourceId(source)}`;
        const profileId =
          candidateIndex === 0 ? baseId : `${baseId}-fallback-${candidateIndex + 1}`;
        const developerInstructions = instructions({
          team: input.manifest.name,
          source,
          taskClass,
          skillName,
          tier: assignment.tier,
          ...(modelRole ? { modelRole } : {}),
          access: assignment.access,
          consultation: assignment.consultation,
          limits: config.limits,
        });
        const model = candidate.model;
        const effort =
          "reasoningEffort" in candidate ? candidate.reasoningEffort : candidate.effort;
        const ownershipMarker = `omniskills-managed: team=${input.manifest.name} source=${source}`;
        const content =
          target === "codex"
            ? renderCodex({
                profileId,
                model,
                effort,
                access: assignment.access,
                developerInstructions,
                ownershipMarker,
              })
            : renderClaude({
                profileId,
                model,
                effort,
                access: assignment.access,
                developerInstructions,
                consultation: assignment.consultation,
                ownershipMarker,
              });
        const extension = target === "codex" ? "toml" : "md";
        const agentDir = resolve(input.homeDir, `.${target}`, "agents");
        const destination = resolve(agentDir, `${profileId}.${extension}`);
        if (!destination.startsWith(`${agentDir}${sep}`)) {
          throw new Error(`Agent profile destination escapes target directory: ${destination}`);
        }
        profiles.push({
          source,
          taskClass,
          profileId,
          target,
          tier: assignment.tier,
          ...(modelRole ? { modelRole } : {}),
          model,
          effort,
          access: assignment.access,
          instructions: developerInstructions,
          consultation: assignment.consultation,
          limits: config.limits,
          candidateIndex,
          candidateCount: candidates.length,
          destination,
          content,
          contentHash: hashAgentProfileContent(content),
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
