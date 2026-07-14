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

export type ConsultationRequest = z.infer<typeof ConsultationRequestSchema>;
export type ConsultationDecision = z.infer<typeof ConsultationDecisionSchema>;
export type DispatchRuntime = z.infer<typeof DispatchRuntimeSchema>;
export type DispatchEvidenceLevel = z.infer<typeof DispatchEvidenceLevelSchema>;

export type OrchestrationDispatchErrorCode =
  | "workflow_not_installed"
  | "profile_not_found"
  | "profile_ambiguous"
  | "profile_path_invalid"
  | "profile_drifted"
  | "profile_missing_dispatch_metadata"
  | "runtime_unavailable"
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

export interface DispatchRequest {
  workflow: string;
  role: string;
  task: string;
  cwd: string;
  homeDir: string;
  runtime: DispatchRuntime;
  approveWorkspaceWrite: boolean;
}

export interface DispatchPlan {
  workflow: string;
  role: string;
  task: string;
  cwd: string;
  homeDir: string;
  profileId: string;
  profilePath: string;
  profileHash: string;
  runtime: DispatchRuntime;
  tier: "deep" | "standard" | "fast";
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
  evidenceRequired: "launch_configured";
  workspaceWriteApproved: boolean;
}

export interface DispatchPlanSet {
  primary: DispatchPlan;
  candidates: DispatchPlan[];
}

export interface DispatchAttempt {
  attemptNumber: number;
  candidateIndex: number;
  profileId: string;
  model: string;
  status: "completed" | "failed" | "consultation_required";
  evidence: "launch_configured" | "runtime_reported";
  sessionId?: string;
  failureCode?: string;
  failureReason?: string;
  fallbackFromAttempt?: number;
  resumeDecision?: ConsultationDecision;
  decisionMessage?: string;
  consultation?: ConsultationRequest;
}

export interface DispatchReceipt {
  schemaVersion: "0.1";
  runId: string;
  workflow: string;
  role: string;
  profileId: string;
  profileHash: string;
  runtime: DispatchRuntime;
  tier: "deep" | "standard" | "fast";
  model: string;
  effort: string;
  access: "read-only" | "workspace-write";
  evidence: DispatchEvidenceLevel;
  adapter: "codex-cli";
  status: "planned" | "completed" | "failed" | "consultation_required";
  consultationCount: number;
  reassignmentCount: number;
  sessionId?: string;
  failureCode?: string;
  failureReason?: string;
  consultation?: ConsultationRequest;
  createdAt: string;
  updatedAt: string;
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
  const priorEvidence = [...prior.evidence].sort();
  const nextEvidence = [...next.evidence].sort();
  return (
    priorEvidence.length === nextEvidence.length &&
    priorEvidence.every((item, index) => item === nextEvidence[index])
  );
}

interface DispatchableProfileArtifact extends WorkflowInstallAgentProfileArtifact {
  taskClass: "role" | "support";
  tier: "deep" | "standard" | "fast";
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
  capabilities: Partial<Record<DispatchRuntime, boolean>>;
  readProfile(path: string): Promise<string>;
}): Promise<DispatchPlanSet> {
  if (Buffer.byteLength(input.task, "utf8") > MAX_DISPATCH_TASK_BYTES) {
    dispatchError("task_too_large", `Dispatch task exceeds ${MAX_DISPATCH_TASK_BYTES} UTF-8 bytes`);
  }
  if (!input.capabilities[input.runtime]) {
    dispatchError("runtime_unavailable", `Dispatch runtime unavailable: ${input.runtime}`);
  }
  const assignment = getAssignment(input.workflow, input.role);
  if (!assignment) {
    dispatchError(
      "profile_not_found",
      `Installed workflow ${input.workflow.name} does not declare orchestration role: ${input.role}`,
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
      model: artifact.model,
      effort: artifact.effort,
      access: artifact.access,
      instructions: artifact.instructions,
      consultation: artifact.consultation,
      limits: artifact.limits,
      candidateIndex: artifact.candidateIndex,
      candidateCount: artifact.candidateCount,
      evidenceRequired: "launch_configured",
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
