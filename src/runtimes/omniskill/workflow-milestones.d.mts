export type MilestoneStage =
  | "preparing"
  | "planning"
  | "awaiting_plan_approval"
  | "implementing"
  | "rework"
  | "verifying"
  | "evaluating"
  | "awaiting_acceptance";

export type MilestoneEventType =
  | "input_packet"
  | "role_output"
  | "evidence_gap"
  | "evidence_resolved"
  | "plan_decision"
  | "implementation_result"
  | "verification_result"
  | "outcome_replay"
  | "acceptance_decision"
  | "repair_request"
  | "targeted_review"
  | "scope_change";

export interface MilestoneInput {
  id: string;
  title: string;
  outcome: string;
  accountableRole: string;
  dependencies: string[];
  acceptanceCriteria: string[];
}

export interface MilestoneRecord extends MilestoneInput {
  status: "pending" | "active" | "accepted" | "skipped";
  stage: MilestoneStage;
  repairCount: number;
  repairPending: boolean;
  targetedReviewCount: number;
  evidenceGaps: Array<{ name: string; critical: boolean; reason: string }>;
  scopeChanges: Array<{ requested: string; approved: boolean; impact: string }>;
  implementationResults: Array<Record<string, unknown>>;
  consumedImplementationResults: number;
  verificationResult: Record<string, unknown> | null;
  outcomeReplay: Record<string, unknown> | null;
  acceptanceDecision: Record<string, unknown> | null;
  [key: string]: unknown;
}

export interface MilestoneState {
  schemaVersion: "0.2";
  status: "active" | "needs_evidence" | "blocked" | "complete";
  goalTunnel: Record<string, unknown>;
  currentMilestoneIndex: number;
  milestones: MilestoneRecord[];
  createdAt: string;
  updatedAt: string;
}

export interface MilestoneEvent {
  type: MilestoneEventType;
  metadata: Record<string, unknown>;
}

export interface MilestoneView {
  status: MilestoneState["status"];
  currentMilestoneIndex: number;
  stage: MilestoneStage | null;
  milestone: Pick<
    MilestoneRecord,
    "id" | "title" | "outcome" | "accountableRole" | "acceptanceCriteria" | "status"
  > | null;
  evidenceGaps: MilestoneRecord["evidenceGaps"];
  repairCount: number;
  targetedReviewCount: number;
  availableDecisions: string[];
}

export function createMilestoneState(input: unknown, now?: string): MilestoneState;
export function recordMilestoneEvent(state: MilestoneState, event: MilestoneEvent): MilestoneState;
export function advanceMilestoneState(state: MilestoneState, now?: string): MilestoneState;
export function getMilestoneView(state: MilestoneState): MilestoneView;
export function buildMilestoneSummary(state: MilestoneState): string;
