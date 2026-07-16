import { z } from "zod";

const NonEmptyString = z.string().trim().min(1);
const StringArray = z.array(NonEmptyString);

const GoalTunnelSchema = z
  .object({
    goal: NonEmptyString,
    user: NonEmptyString,
    problem: NonEmptyString,
    outcome: NonEmptyString,
    scope: StringArray,
    nonGoals: StringArray,
    constraints: StringArray,
    successCriteria: StringArray,
    assumptions: StringArray,
  })
  .strict();

const MilestoneInputSchema = z
  .object({
    id: NonEmptyString,
    title: NonEmptyString,
    outcome: NonEmptyString,
    accountableRole: NonEmptyString,
    dependencies: StringArray,
    acceptanceCriteria: StringArray,
  })
  .strict();

const StartInputSchema = z
  .object({
    goalTunnel: GoalTunnelSchema,
    milestones: z.array(MilestoneInputSchema).min(1),
  })
  .strict();

const InputPacketSchema = z
  .object({
    featureOutcome: NonEmptyString,
    sourceContext: StringArray,
    constraints: StringArray,
    permissions: StringArray,
    decision: NonEmptyString,
    expectedArtifact: NonEmptyString,
    acceptanceCriteria: StringArray,
    priorDecisions: StringArray,
    accountableRole: NonEmptyString,
  })
  .strict();

const EvidenceItemSchema = z.discriminatedUnion("classification", [
  z
    .object({
      claim: NonEmptyString,
      classification: z.literal("verified"),
      risk: z.enum(["low", "high"]),
      source: NonEmptyString,
    })
    .passthrough(),
  z
    .object({
      claim: NonEmptyString,
      classification: z.literal("inferred"),
      risk: z.enum(["low", "high"]),
      supports: z.array(NonEmptyString).min(1),
    })
    .passthrough(),
  z
    .object({
      claim: NonEmptyString,
      classification: z.literal("assumed"),
      risk: z.enum(["low", "high"]),
      consequence: NonEmptyString,
      validationAction: NonEmptyString,
    })
    .passthrough(),
]);

const RoleOutputSchema = z
  .object({
    role: NonEmptyString,
    recommendation: NonEmptyString,
    alternatives: StringArray,
    evidence: z.array(EvidenceItemSchema),
    risks: StringArray,
    unresolvedQuestions: StringArray,
    verificationMethod: NonEmptyString,
    nextAction: NonEmptyString,
  })
  .strict();

const OutcomeItemSchema = z
  .object({
    original: NonEmptyString,
    originalEvidence: NonEmptyString,
    status: z.enum(["met", "partially_met", "unmet", "not_evaluated"]),
    resultEvidence: NonEmptyString,
    gapType: z.enum(["approved_requirement", "new_wish", "none"]),
  })
  .strict();

const JourneyStepSchema = z
  .object({
    expected: NonEmptyString,
    actual: NonEmptyString,
    status: z.enum(["met", "partially_met", "unmet", "not_evaluated"]),
    resultEvidence: NonEmptyString,
  })
  .strict();

const OutcomeReplaySchema = z
  .object({
    user: NonEmptyString,
    expectations: z.array(OutcomeItemSchema),
    needs: z.array(OutcomeItemSchema),
    wishes: z.array(OutcomeItemSchema),
    steps: z.array(JourneyStepSchema),
    recommendation: z.enum(["accept", "rework", "new_milestone"]),
  })
  .strict();

const PlanDecisionSchema = z
  .object({
    decision: z.enum(["approve", "revise", "research", "skip", "stop"]),
    approvedBy: NonEmptyString,
  })
  .strict();

const ImplementationResultSchema = z
  .object({
    summary: NonEmptyString,
    changedFiles: StringArray,
    verificationCommands: StringArray,
  })
  .strict();

const VerificationResultSchema = z
  .object({
    result: z.enum(["pass", "fail"]),
    evidence: StringArray,
    residualRisk: StringArray,
  })
  .strict();

const AcceptanceDecisionSchema = z
  .object({
    decision: z.enum(["accept", "rework", "new_milestone", "rollback", "stop"]),
    approvedBy: NonEmptyString,
    newMilestone: MilestoneInputSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.decision === "new_milestone" && !value.newMilestone) {
      context.addIssue({ code: "custom", message: "newMilestone is required" });
    }
  });

const EventSchemas = {
  input_packet: InputPacketSchema,
  role_output: RoleOutputSchema,
  evidence_gap: z
    .object({ name: NonEmptyString, critical: z.boolean(), reason: NonEmptyString })
    .strict(),
  evidence_resolved: z.object({ name: NonEmptyString, resolution: NonEmptyString }).strict(),
  plan_decision: PlanDecisionSchema,
  implementation_result: ImplementationResultSchema,
  verification_result: VerificationResultSchema,
  outcome_replay: OutcomeReplaySchema,
  acceptance_decision: AcceptanceDecisionSchema,
  repair_request: z.object({ reason: NonEmptyString }).strict(),
  targeted_review: z.object({ reason: NonEmptyString }).strict(),
  scope_change: z
    .object({ requested: NonEmptyString, approved: z.boolean(), impact: NonEmptyString })
    .strict(),
};

const StageEvents = {
  input_packet: ["preparing"],
  role_output: ["planning"],
  plan_decision: ["awaiting_plan_approval"],
  implementation_result: ["implementing", "rework"],
  verification_result: ["verifying"],
  outcome_replay: ["evaluating"],
  acceptance_decision: ["awaiting_acceptance"],
  repair_request: ["preparing", "planning"],
  targeted_review: ["preparing", "planning"],
};

const clone = (value) => structuredClone(value);
const active = (state) => state.milestones[state.currentMilestoneIndex];

function validateStart(value) {
  const input = StartInputSchema.parse(value);
  const positions = new Map();
  input.milestones.forEach((item, index) => {
    if (positions.has(item.id)) throw new Error(`Duplicate milestone id: ${item.id}`);
    positions.set(item.id, index);
  });
  input.milestones.forEach((item, index) => {
    item.dependencies.forEach((dependency) => {
      if (!positions.has(dependency))
        throw new Error(`Unknown milestone dependency: ${dependency}`);
      if (positions.get(dependency) >= index)
        throw new Error(`Milestone dependency must refer to an earlier milestone: ${dependency}`);
    });
  });
  return clone(input);
}

function createMilestoneRecord(item, status = "pending") {
  return {
    ...clone(item),
    status,
    stage: "preparing",
    repairCount: 0,
    repairPending: false,
    targetedReviewCount: 0,
    inputPacket: null,
    roleOutputs: [],
    evidenceGaps: [],
    scopeChanges: [],
    planDecision: null,
    implementationResults: [],
    consumedImplementationResults: 0,
    verificationResult: null,
    outcomeReplay: null,
    acceptanceDecision: null,
  };
}

export function createMilestoneState(value, now = new Date().toISOString()) {
  const input = validateStart(value);
  return {
    schemaVersion: "0.2",
    status: "active",
    goalTunnel: input.goalTunnel,
    currentMilestoneIndex: 0,
    milestones: input.milestones.map((item, index) =>
      createMilestoneRecord(item, index ? "pending" : "active"),
    ),
    createdAt: now,
    updatedAt: now,
  };
}

function requireEventStage(item, type) {
  const allowed = StageEvents[type];
  if (allowed && !allowed.includes(item.stage)) {
    throw new Error(`${type} is not allowed during ${item.stage}`);
  }
}

export function recordMilestoneEvent(original, event) {
  const state = clone(original);
  const item = active(state);
  const schema = EventSchemas[event.type];
  if (!schema) throw new Error(`Unsupported milestone event type: ${event.type}`);
  if (state.status === "complete" || state.status === "blocked") {
    throw new Error(`Cannot record milestone event with status ${state.status}`);
  }
  if (
    state.status === "needs_evidence" &&
    !["evidence_gap", "evidence_resolved"].includes(event.type)
  ) {
    throw new Error("Resolve critical evidence gaps before recording more milestone work");
  }
  requireEventStage(item, event.type);
  const metadata = schema.parse(event.metadata ?? {});

  switch (event.type) {
    case "input_packet":
      if (metadata.accountableRole !== item.accountableRole)
        throw new Error("input_packet accountableRole must match the milestone owner");
      item.inputPacket = metadata;
      break;
    case "role_output":
      if (item.repairPending) {
        const index = item.roleOutputs.findLastIndex((output) => output.role === metadata.role);
        if (index < 0) item.roleOutputs.push(metadata);
        else item.roleOutputs[index] = metadata;
        item.repairPending = false;
      } else item.roleOutputs.push(metadata);
      break;
    case "evidence_gap":
      if (item.evidenceGaps.some((gap) => gap.name === metadata.name))
        throw new Error(`Evidence gap already exists: ${metadata.name}`);
      item.evidenceGaps.push(metadata);
      state.status = "needs_evidence";
      break;
    case "evidence_resolved": {
      const index = item.evidenceGaps.findIndex((gap) => gap.name === metadata.name);
      if (index < 0) throw new Error(`Unknown evidence gap: ${metadata.name}`);
      item.evidenceGaps.splice(index, 1);
      if (!item.evidenceGaps.some((gap) => gap.critical)) state.status = "active";
      break;
    }
    case "repair_request":
      if (item.repairCount >= 1) throw new Error("Only one output repair is allowed per milestone");
      item.repairCount += 1;
      item.repairPending = true;
      break;
    case "targeted_review":
      if (item.targetedReviewCount >= 1)
        throw new Error("Only one targeted second review is allowed per milestone");
      item.targetedReviewCount += 1;
      break;
    case "plan_decision":
      item.planDecision = metadata;
      break;
    case "implementation_result":
      item.implementationResults.push(metadata);
      break;
    case "verification_result":
      item.verificationResult = metadata;
      break;
    case "outcome_replay":
      item.outcomeReplay = metadata;
      break;
    case "acceptance_decision":
      item.acceptanceDecision = metadata;
      break;
    case "scope_change":
      item.scopeChanges.push(metadata);
      state.status = "blocked";
      break;
  }
  return state;
}

function activateNext(state, completedStatus = "accepted") {
  const item = active(state);
  item.status = completedStatus;
  const next = state.currentMilestoneIndex + 1;
  if (next >= state.milestones.length) {
    state.status = "complete";
    return;
  }
  state.currentMilestoneIndex = next;
  state.milestones[next].status = "active";
}

function appendMilestone(state, value) {
  const milestone = MilestoneInputSchema.parse(value);
  if (state.milestones.some((item) => item.id === milestone.id))
    throw new Error(`Duplicate milestone id: ${milestone.id}`);
  const known = new Set(state.milestones.map((item) => item.id));
  for (const dependency of milestone.dependencies) {
    if (!known.has(dependency)) throw new Error(`Unknown milestone dependency: ${dependency}`);
  }
  state.milestones.push(createMilestoneRecord(milestone));
}

function enterRework(item) {
  item.stage = "rework";
  item.outcomeReplay = null;
  item.acceptanceDecision = null;
}

export function advanceMilestoneState(original, now = new Date().toISOString()) {
  const state = clone(original);
  const item = active(state);
  if (state.status !== "active")
    throw new Error(`Cannot advance milestone run with status ${state.status}`);
  switch (item.stage) {
    case "preparing":
      if (!item.inputPacket) throw new Error("Input packet is required before planning");
      item.stage = "planning";
      break;
    case "planning":
      if (!item.roleOutputs.length)
        throw new Error("At least one role output is required before plan approval");
      if (
        item.roleOutputs.some((output) =>
          output.evidence.some(
            (evidence) => evidence.risk === "high" && evidence.classification !== "verified",
          ),
        )
      )
        throw new Error("High-risk claims must be verified before plan approval");
      item.stage = "awaiting_plan_approval";
      break;
    case "awaiting_plan_approval":
      if (!item.planDecision) throw new Error("Plan decision is required");
      if (item.planDecision.decision === "approve") item.stage = "implementing";
      else if (["revise", "research"].includes(item.planDecision.decision)) {
        item.planDecision = null;
        item.stage = "planning";
      } else if (item.planDecision.decision === "skip") activateNext(state, "skipped");
      else if (item.planDecision.decision === "stop") state.status = "blocked";
      break;
    case "implementing":
    case "rework":
      if (item.implementationResults.length <= item.consumedImplementationResults)
        throw new Error("A new implementation result is required");
      item.consumedImplementationResults = item.implementationResults.length;
      item.verificationResult = null;
      item.stage = "verifying";
      break;
    case "verifying":
      if (!item.verificationResult) throw new Error("Verification result is required");
      if (item.verificationResult.result === "pass") item.stage = "evaluating";
      else enterRework(item);
      break;
    case "evaluating":
      if (!item.outcomeReplay) throw new Error("User Outcome Replay is required");
      if (item.outcomeReplay.recommendation === "rework") enterRework(item);
      else item.stage = "awaiting_acceptance";
      break;
    case "awaiting_acceptance":
      if (!item.acceptanceDecision) throw new Error("Acceptance decision is required");
      if (item.acceptanceDecision.decision === "accept") activateNext(state);
      else if (item.acceptanceDecision.decision === "rework") enterRework(item);
      else if (item.acceptanceDecision.decision === "new_milestone") {
        appendMilestone(state, item.acceptanceDecision.newMilestone);
        activateNext(state);
      } else state.status = "blocked";
      break;
    default:
      throw new Error(`Unsupported milestone stage: ${item.stage}`);
  }
  state.updatedAt = now;
  return state;
}

const AvailableDecisions = {
  awaiting_plan_approval: ["approve", "revise", "research", "skip", "stop"],
  awaiting_acceptance: ["accept", "rework", "new_milestone", "rollback", "stop"],
};

export function getMilestoneView(state) {
  const item = active(state);
  return {
    status: state.status,
    currentMilestoneIndex: state.currentMilestoneIndex,
    stage: item?.stage ?? null,
    milestone: item
      ? {
          id: item.id,
          title: item.title,
          outcome: item.outcome,
          accountableRole: item.accountableRole,
          acceptanceCriteria: item.acceptanceCriteria,
          status: item.status,
        }
      : null,
    evidenceGaps: item?.evidenceGaps ?? [],
    repairCount: item?.repairCount ?? 0,
    targetedReviewCount: item?.targetedReviewCount ?? 0,
    availableDecisions: AvailableDecisions[item?.stage] ?? [],
  };
}

const formatItems = (items) =>
  items.length
    ? items.map((item) => `- ${item.original}: ${item.status} (${item.resultEvidence})`)
    : ["- none"];

export function buildMilestoneSummary(state) {
  const gaps = state.milestones.flatMap((item) =>
    item.evidenceGaps.map((gap) => `- ${item.id}/${gap.name}: ${gap.reason}`),
  );
  const verification = state.milestones.map((item) =>
    item.verificationResult
      ? `- ${item.id}: ${item.verificationResult.result}; ${item.verificationResult.evidence.join(", ")}`
      : `- ${item.id}: not verified`,
  );
  const replays = state.milestones.map((item) => item.outcomeReplay).filter(Boolean);
  const outcomeItems = replays.flatMap((replay) => [
    ...replay.expectations,
    ...replay.needs,
    ...replay.wishes,
  ]);
  return [
    "# Goal Tunnel",
    JSON.stringify(state.goalTunnel, null, 2),
    "",
    "## Milestones",
    ...state.milestones.map((item) => `- ${item.id}: ${item.status} (${item.stage})`),
    "",
    "## Evidence Gaps",
    ...(gaps.length ? gaps : ["- none"]),
    "",
    "## Verification",
    ...verification,
    "",
    "## User Outcome Replay",
    "### Approved Requirements",
    ...formatItems(outcomeItems.filter((item) => item.gapType !== "new_wish")),
    "",
    "### New Wishes",
    ...formatItems(outcomeItems.filter((item) => item.gapType === "new_wish")),
    "",
    "### Journey",
    ...(replays.flatMap((replay) => replay.steps).length
      ? replays
          .flatMap((replay) => replay.steps)
          .map((step) => `- ${step.expected} -> ${step.actual}: ${step.status}`)
      : ["- none"]),
  ].join("\n");
}
