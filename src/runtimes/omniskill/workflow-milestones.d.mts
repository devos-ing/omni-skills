export interface MilestoneInput {
  id: string;
  title: string;
  outcome: string;
  accountableRole: string;
  dependencies: string[];
  acceptanceCriteria: string[];
}

export interface MilestoneRecord extends MilestoneInput {
  status: "pending" | "active" | "accepted";
  stage: string;
  repairCount: number;
  targetedReviewCount: number;
  outcomeReplay: Record<string, unknown> | null;
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
  type: string;
  metadata: Record<string, unknown>;
}

export function createMilestoneState(input: unknown, now?: string): MilestoneState;
export function recordMilestoneEvent(state: MilestoneState, event: MilestoneEvent): MilestoneState;
export function advanceMilestoneState(state: MilestoneState, now?: string): MilestoneState;
export function getMilestoneView(state: MilestoneState): Record<string, unknown>;
export function buildMilestoneSummary(state: MilestoneState): string;
