import { resolve } from "node:path";
import { z } from "zod";
import { hashAgentProfileContent } from "./orchestration";
import type {
  InstalledWorkflowBundle,
  WorkflowInstallAgentProfileArtifact,
} from "./workflow-bundles";

export const DispatchRuntimeSchema = z.enum(["codex", "claude"]);
export const DispatchEvidenceLevelSchema = z.enum([
  "requested",
  "launch_configured",
  "runtime_reported",
]);
export const DispatchAdapterSchema = z.enum(["codex-cli"]);
export const DispatchCapabilitySchema = z
  .object({
    available: z.boolean(),
    adapter: DispatchAdapterSchema,
    evidenceCapability: z.literal("launch_configured"),
  })
  .strict();
export const MAX_DISPATCH_TASK_BYTES = 64 * 1024;

export const ConsultationRequestSchema = z
  .object({
    type: z.literal("consultation_request"),
    trigger: z.enum(["ambiguity", "requirement_conflict", "elevated_risk", "failed_verification"]),
    current_task: z.string().min(1),
    evidence: z.array(z.string().min(1)).min(1),
    decision_needed: z.string().min(1),
    recommendation: z.string().min(1),
  })
  .strict();

export const ConsultationDecisionSchema = z.enum([
  "continue",
  "retry",
  "reassign",
  "escalate-to-human",
]);

export const DispatchFailureCodeSchema = z.enum([
  "consultation_limit_exceeded",
  "consultation_repeated_evidence",
  "human_escalation_required",
  "model_role_runtime_unsupported",
  "model_unavailable",
  "retry_exhausted",
  "runtime_failed",
  "runtime_mismatch",
  "runtime_upgrade_required",
]);

const DispatchTierSchema = z.enum(["deep", "standard", "fast"]);
const DispatchModelRoleSchema = z.enum(["planning", "implementation", "verification"]);
const DispatchAccessSchema = z.enum(["read-only", "workspace-write"]);
const DispatchStatusSchema = z.enum(["planned", "completed", "failed", "consultation_required"]);
const AttemptStatusSchema = z.enum(["completed", "failed", "consultation_required"]);
const DispatchLimitsSchema = z
  .object({
    retryPerCandidate: z.number().int().nonnegative(),
    reassignmentPerWorkItem: z.number().int().nonnegative(),
    consultationsPerAgent: z.number().int().nonnegative(),
  })
  .strict();

export const DispatchRequestSchema = z
  .object({
    workflow: z.string().min(1),
    role: z.string().min(1),
    task: z.string(),
    cwd: z.string().min(1),
    homeDir: z.string().min(1),
    runtime: DispatchRuntimeSchema,
    approveWorkspaceWrite: z.boolean(),
  })
  .strict();

export const DispatchPlanSchema = z
  .object({
    workflow: z.string().min(1),
    role: z.string().min(1),
    task: z.string(),
    cwd: z.string().min(1),
    homeDir: z.string().min(1),
    profileId: z.string().min(1),
    profilePath: z.string().min(1),
    profileHash: z.string().min(1),
    runtime: DispatchRuntimeSchema,
    tier: DispatchTierSchema,
    modelRole: DispatchModelRoleSchema.optional(),
    model: z.string().min(1),
    effort: z.string().min(1),
    access: DispatchAccessSchema,
    instructions: z.string().min(1),
    consultation: z.enum(["receive", "request", "none"]),
    limits: DispatchLimitsSchema,
    candidateIndex: z.number().int().nonnegative(),
    candidateCount: z.number().int().positive(),
    adapter: DispatchAdapterSchema,
    evidenceCapability: z.literal("launch_configured"),
    workspaceWriteApproved: z.boolean(),
  })
  .strict();

export const DispatchPlanSetSchema = z
  .object({
    primary: DispatchPlanSchema,
    candidates: z.array(DispatchPlanSchema).min(1),
  })
  .strict();

export const DispatchAttemptSchema = z
  .object({
    runId: z.string().min(1),
    plan: DispatchPlanSchema,
    attemptNumber: z.number().int().positive(),
    candidateIndex: z.number().int().nonnegative(),
    modelRole: DispatchModelRoleSchema.optional(),
    profileId: z.string().min(1),
    model: z.string().min(1),
    status: AttemptStatusSchema,
    evidence: z.enum(["launch_configured", "runtime_reported"]),
    sessionId: z.string().min(1).optional(),
    failureCode: DispatchFailureCodeSchema.optional(),
    failureReason: z.string().min(1).optional(),
    fallbackFromAttempt: z.number().int().positive().optional(),
    resumeDecision: ConsultationDecisionSchema.optional(),
    decisionMessage: z.string().min(1).optional(),
    consultation: ConsultationRequestSchema.optional(),
    createdAt: z.string().datetime(),
  })
  .strict();

export const DispatchReceiptSchema = z
  .object({
    schemaVersion: z.literal("0.1"),
    runId: z.string().min(1),
    workflow: z.string().min(1),
    role: z.string().min(1),
    profileId: z.string().min(1),
    profileHash: z.string().min(1),
    runtime: DispatchRuntimeSchema,
    tier: DispatchTierSchema,
    modelRole: DispatchModelRoleSchema.optional(),
    model: z.string().min(1),
    effort: z.string().min(1),
    access: DispatchAccessSchema,
    candidateIndex: z.number().int().nonnegative(),
    candidateCount: z.number().int().positive(),
    workspaceWriteApproved: z.boolean(),
    evidence: DispatchEvidenceLevelSchema,
    adapter: z.literal("codex-cli"),
    status: DispatchStatusSchema,
    consultationCount: z.number().int().nonnegative(),
    reassignmentCount: z.number().int().nonnegative(),
    sessionId: z.string().min(1).optional(),
    failureCode: DispatchFailureCodeSchema.optional(),
    failureReason: z.string().min(1).optional(),
    consultation: ConsultationRequestSchema.optional(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export type ConsultationRequest = z.infer<typeof ConsultationRequestSchema>;
export type ConsultationDecision = z.infer<typeof ConsultationDecisionSchema>;
export type DispatchRuntime = z.infer<typeof DispatchRuntimeSchema>;
export type DispatchEvidenceLevel = z.infer<typeof DispatchEvidenceLevelSchema>;
export type DispatchCapability = z.infer<typeof DispatchCapabilitySchema>;
export type DispatchFailureCode = z.infer<typeof DispatchFailureCodeSchema>;
export type DispatchRequest = z.infer<typeof DispatchRequestSchema>;
export type DispatchPlan = z.infer<typeof DispatchPlanSchema>;
export type DispatchPlanSet = z.infer<typeof DispatchPlanSetSchema>;
export type DispatchAttempt = z.infer<typeof DispatchAttemptSchema>;
export type DispatchReceipt = z.infer<typeof DispatchReceiptSchema>;

export type OrchestrationDispatchErrorCode =
  | "workflow_not_installed"
  | "profile_not_found"
  | "profile_ambiguous"
  | "profile_path_invalid"
  | "profile_drifted"
  | "profile_missing_dispatch_metadata"
  | "runtime_unavailable"
  | "model_role_runtime_unsupported"
  | "approval_required"
  | "task_too_large";

export class OrchestrationDispatchError extends Error {
  constructor(
    public readonly code: OrchestrationDispatchErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrchestrationDispatchError";
  }
}

export function createDispatchAttemptSchedule(planSet: DispatchPlanSet): DispatchPlan[] {
  return planSet.candidates.flatMap((candidate) =>
    Array.from({ length: candidate.limits.retryPerCandidate + 1 }, () => candidate),
  );
}

export function hasRepeatedConsultationEvidence(
  prior: ConsultationRequest,
  next: ConsultationRequest,
): boolean {
  const priorEvidence = [...new Set(prior.evidence)].sort();
  const nextEvidence = [...new Set(next.evidence)].sort();
  return (
    priorEvidence.length === nextEvidence.length &&
    priorEvidence.every((item, index) => item === nextEvidence[index])
  );
}

interface DispatchableProfileArtifact extends WorkflowInstallAgentProfileArtifact {
  taskClass: "role" | "support";
  tier: "deep" | "standard" | "fast";
  modelRole?: "planning" | "implementation" | "verification";
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  instructions: string;
  consultation: "receive" | "request" | "none";
  limits: {
    retryPerCandidate: number;
    reassignmentPerWorkItem: number;
    consultationsPerAgent: number;
  };
  candidateIndex: number;
  candidateCount: number;
}

function dispatchError(code: OrchestrationDispatchErrorCode, message: string): never {
  throw new OrchestrationDispatchError(code, message);
}

function hasDispatchMetadata(
  artifact: WorkflowInstallAgentProfileArtifact,
): artifact is DispatchableProfileArtifact {
  return (
    artifact.taskClass !== undefined &&
    artifact.tier !== undefined &&
    artifact.model !== undefined &&
    artifact.effort !== undefined &&
    artifact.access !== undefined &&
    artifact.instructions !== undefined &&
    artifact.consultation !== undefined &&
    artifact.limits !== undefined &&
    artifact.candidateIndex !== undefined &&
    artifact.candidateCount !== undefined
  );
}

function getAssignment(workflow: InstalledWorkflowBundle, role: string) {
  return workflow.orchestration?.roles[role] ?? workflow.orchestration?.support?.[role];
}

export async function planOrchestrationDispatch(input: {
  workflow: InstalledWorkflowBundle;
  role: string;
  runtime: DispatchRuntime;
  task: string;
  cwd: string;
  homeDir: string;
  approveWorkspaceWrite: boolean;
  capabilities: Partial<Record<DispatchRuntime, DispatchCapability>>;
  readProfile(path: string): Promise<string>;
}): Promise<DispatchPlanSet> {
  if (Buffer.byteLength(input.task, "utf8") > MAX_DISPATCH_TASK_BYTES) {
    dispatchError("task_too_large", `Dispatch task exceeds ${MAX_DISPATCH_TASK_BYTES} UTF-8 bytes`);
  }
  const capability = input.capabilities[input.runtime];
  if (!capability?.available) {
    dispatchError("runtime_unavailable", `Dispatch runtime unavailable: ${input.runtime}`);
  }
  const assignment = getAssignment(input.workflow, input.role);
  if (!assignment) {
    dispatchError(
      "profile_not_found",
      `Installed workflow ${input.workflow.name} does not declare orchestration role: ${input.role}`,
    );
  }
  if (assignment.modelRole && input.runtime !== "codex") {
    dispatchError(
      "model_role_runtime_unsupported",
      `Model-role routing supports Codex CLI only: ${input.role}`,
    );
  }
  const matches = (input.workflow.installArtifacts ?? []).filter(
    (artifact): artifact is WorkflowInstallAgentProfileArtifact =>
      artifact.kind === "agent_profile" &&
      artifact.source === input.role &&
      artifact.agent === input.runtime,
  );
  if (matches.length === 0) {
    dispatchError(
      "profile_not_found",
      `No managed ${input.runtime} profile is installed for ${input.role}`,
    );
  }
  const candidateIndexes = new Set<number>();
  for (const artifact of matches) {
    const candidateIndex = artifact.candidateIndex ?? 0;
    if (candidateIndexes.has(candidateIndex)) {
      dispatchError(
        "profile_ambiguous",
        `Multiple managed profiles claim candidate ${candidateIndex + 1} for ${input.role}`,
      );
    }
    candidateIndexes.add(candidateIndex);
  }

  const expectedDir = resolve(input.homeDir, `.${input.runtime}`, "agents");
  const extension = input.runtime === "codex" ? "toml" : "md";
  const candidates: DispatchPlan[] = [];
  for (const artifact of matches) {
    if (!hasDispatchMetadata(artifact)) {
      dispatchError(
        "profile_missing_dispatch_metadata",
        `Managed profile ${artifact.profileId} predates dispatch metadata; reinstall ${input.workflow.name}`,
      );
    }
    const expectedPath = resolve(expectedDir, `${artifact.profileId}.${extension}`);
    if (resolve(artifact.path) !== expectedPath) {
      dispatchError(
        "profile_path_invalid",
        `Managed profile path is outside its expected runtime destination: ${artifact.path}`,
      );
    }
    const content = await input.readProfile(artifact.path);
    const ownershipMarker = `omniskills-managed: team=${input.workflow.name} source=${input.role}`;
    if (
      !content.includes(ownershipMarker) ||
      hashAgentProfileContent(content) !== artifact.contentHash
    ) {
      dispatchError(
        "profile_drifted",
        `Managed profile has drifted; reinstall ${input.workflow.name} before dispatch: ${artifact.path}`,
      );
    }
    if (
      artifact.tier !== assignment.tier ||
      artifact.modelRole !== assignment.modelRole ||
      artifact.access !== assignment.access ||
      artifact.consultation !== assignment.consultation
    ) {
      dispatchError(
        "profile_drifted",
        `Managed profile policy no longer matches installed workflow role: ${input.role}`,
      );
    }
    if (artifact.access === "workspace-write" && !input.approveWorkspaceWrite) {
      dispatchError(
        "approval_required",
        `Workspace-write dispatch requires --approve-workspace-write: ${input.role}`,
      );
    }
    candidates.push({
      workflow: input.workflow.name,
      role: input.role,
      task: input.task,
      cwd: resolve(input.cwd),
      homeDir: resolve(input.homeDir),
      profileId: artifact.profileId,
      profilePath: artifact.path,
      profileHash: artifact.contentHash,
      runtime: input.runtime,
      tier: artifact.tier,
      ...(artifact.modelRole ? { modelRole: artifact.modelRole } : {}),
      model: artifact.model,
      effort: artifact.effort,
      access: artifact.access,
      instructions: artifact.instructions,
      consultation: artifact.consultation,
      limits: artifact.limits,
      candidateIndex: artifact.candidateIndex,
      candidateCount: artifact.candidateCount,
      adapter: capability.adapter,
      evidenceCapability: capability.evidenceCapability,
      workspaceWriteApproved: artifact.access === "workspace-write",
    });
  }
  candidates.sort((left, right) => left.candidateIndex - right.candidateIndex);
  const primary = candidates[0];
  if (primary?.candidateIndex !== 0) {
    dispatchError("profile_not_found", `Primary managed profile is missing for ${input.role}`);
  }
  if (
    candidates.some(
      (candidate) =>
        candidate.runtime !== primary.runtime ||
        candidate.tier !== primary.tier ||
        candidate.candidateCount !== candidates.length,
    )
  ) {
    dispatchError("profile_ambiguous", `Managed profile candidates disagree for ${input.role}`);
  }
  return { primary, candidates };
}
