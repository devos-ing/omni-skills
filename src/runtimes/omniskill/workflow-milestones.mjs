const clone = (value) => structuredClone(value);
const object = (value, name) => {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${name} must be an object`);
  return value;
};
const string = (value, name) => {
  if (typeof value !== "string" || !value.trim())
    throw new Error(`${name} must be a non-empty string`);
  return value;
};
const strings = (value, name) => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || !item.trim()))
    throw new Error(`${name} must be an array of strings`);
  return value;
};

function validateStart(value) {
  const input = object(value, "start input");
  const goal = object(input.goalTunnel, "goalTunnel");
  for (const key of ["goal", "user", "problem", "outcome"]) string(goal[key], `goalTunnel.${key}`);
  for (const key of ["scope", "nonGoals", "constraints", "successCriteria", "assumptions"])
    strings(goal[key], `goalTunnel.${key}`);
  if (!Array.isArray(input.milestones) || !input.milestones.length)
    throw new Error("start input milestones must contain at least one milestone");
  const positions = new Map();
  input.milestones.forEach((raw, index) => {
    const item = object(raw, "milestone");
    for (const key of ["id", "title", "outcome", "accountableRole"])
      string(item[key], `milestone.${key}`);
    strings(item.dependencies, "milestone.dependencies");
    strings(item.acceptanceCriteria, "milestone.acceptanceCriteria");
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

const active = (state) => state.milestones[state.currentMilestoneIndex];
const requireFields = (metadata, names, label) => {
  const value = object(metadata, label);
  for (const name of names) string(value[name], `${label}.${name}`);
  return value;
};

function validateEvidence(items) {
  if (!Array.isArray(items)) throw new Error("role_output.evidence must be an array");
  for (const raw of items) {
    const item = requireFields(raw, ["claim", "classification", "risk"], "evidence");
    if (item.classification === "verified") string(item.source, "evidence.source");
    else if (item.classification === "inferred") strings(item.supports, "evidence.supports");
    else if (item.classification === "assumed") {
      string(item.consequence, "evidence.consequence");
      string(item.validationAction, "evidence.validationAction");
    } else throw new Error(`Unsupported evidence classification: ${item.classification}`);
    if (!new Set(["low", "high"]).has(item.risk))
      throw new Error(`Unsupported evidence risk: ${item.risk}`);
  }
}

export function createMilestoneState(value, now = new Date().toISOString()) {
  const input = validateStart(value);
  return {
    schemaVersion: "0.2",
    status: "active",
    goalTunnel: input.goalTunnel,
    currentMilestoneIndex: 0,
    milestones: input.milestones.map((item, index) => ({
      ...item,
      status: index ? "pending" : "active",
      stage: "preparing",
      repairCount: 0,
      targetedReviewCount: 0,
      inputPacket: null,
      roleOutputs: [],
      evidenceGaps: [],
      planDecision: null,
      implementationResults: [],
      verificationResult: null,
      outcomeReplay: null,
      acceptanceDecision: null,
    })),
    createdAt: now,
    updatedAt: now,
  };
}

export function recordMilestoneEvent(original, event) {
  const state = clone(original);
  const item = active(state);
  const metadata = object(event.metadata ?? {}, `${event.type} metadata`);
  switch (event.type) {
    case "input_packet":
      requireFields(
        metadata,
        ["featureOutcome", "decision", "expectedArtifact", "accountableRole"],
        "input_packet",
      );
      if (metadata.accountableRole !== item.accountableRole)
        throw new Error("input_packet accountableRole must match the milestone owner");
      for (const key of [
        "sourceContext",
        "constraints",
        "permissions",
        "acceptanceCriteria",
        "priorDecisions",
      ])
        strings(metadata[key], `input_packet.${key}`);
      item.inputPacket = metadata;
      break;
    case "role_output":
      requireFields(
        metadata,
        ["role", "recommendation", "verificationMethod", "nextAction"],
        "role_output",
      );
      for (const key of ["alternatives", "risks", "unresolvedQuestions"])
        strings(metadata[key], `role_output.${key}`);
      validateEvidence(metadata.evidence);
      item.roleOutputs.push(metadata);
      break;
    case "repair_request":
      if (item.repairCount >= 1) throw new Error("Only one output repair is allowed per milestone");
      string(metadata.reason, "repair_request.reason");
      item.repairCount += 1;
      break;
    case "targeted_review":
      if (item.targetedReviewCount >= 1)
        throw new Error("Only one targeted second review is allowed per milestone");
      string(metadata.reason, "targeted_review.reason");
      item.targetedReviewCount += 1;
      break;
    case "plan_decision":
      item.planDecision = requireFields(metadata, ["decision", "approvedBy"], "plan_decision");
      break;
    case "implementation_result":
      requireFields(metadata, ["summary"], "implementation_result");
      strings(metadata.changedFiles, "implementation_result.changedFiles");
      strings(metadata.verificationCommands, "implementation_result.verificationCommands");
      item.implementationResults.push(metadata);
      break;
    case "verification_result":
      requireFields(metadata, ["result"], "verification_result");
      strings(metadata.evidence, "verification_result.evidence");
      strings(metadata.residualRisk, "verification_result.residualRisk");
      item.verificationResult = metadata;
      break;
    case "outcome_replay":
      item.outcomeReplay = metadata;
      break;
    case "acceptance_decision":
      item.acceptanceDecision = requireFields(
        metadata,
        ["decision", "approvedBy"],
        "acceptance_decision",
      );
      break;
    default:
      throw new Error(`Unsupported milestone event type: ${event.type}`);
  }
  return state;
}

function activateNext(state) {
  const item = active(state);
  item.status = "accepted";
  const next = state.currentMilestoneIndex + 1;
  if (next >= state.milestones.length) {
    state.status = "complete";
    return;
  }
  state.currentMilestoneIndex = next;
  state.milestones[next].status = "active";
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
      } else if (item.planDecision.decision === "stop") state.status = "blocked";
      else throw new Error(`Unsupported plan decision: ${item.planDecision.decision}`);
      break;
    case "implementing":
    case "rework":
      if (!item.implementationResults.length) throw new Error("Implementation result is required");
      item.stage = "verifying";
      break;
    case "verifying":
      if (!item.verificationResult) throw new Error("Verification result is required");
      item.stage = item.verificationResult.result === "pass" ? "evaluating" : "rework";
      item.verificationResult = null;
      break;
    case "evaluating":
      if (!item.outcomeReplay) throw new Error("User Outcome Replay is required");
      item.stage =
        item.outcomeReplay.recommendation === "rework" ? "rework" : "awaiting_acceptance";
      break;
    case "awaiting_acceptance":
      if (!item.acceptanceDecision) throw new Error("Acceptance decision is required");
      if (item.acceptanceDecision.decision === "accept") activateNext(state);
      else if (item.acceptanceDecision.decision === "rework") item.stage = "rework";
      else state.status = "blocked";
      break;
    default:
      throw new Error(`Unsupported milestone stage: ${item.stage}`);
  }
  state.updatedAt = now;
  return state;
}

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
  };
}

export function buildMilestoneSummary(state) {
  return [
    `# Goal Tunnel`,
    state.goalTunnel.goal,
    "",
    "## Milestones",
    ...state.milestones.map((item) => `- ${item.id}: ${item.status}`),
    "",
    "## User Outcome Replay",
    JSON.stringify(state.milestones.map((item) => item.outcomeReplay).filter(Boolean), null, 2),
  ].join("\n");
}
