"use client";

import {
  Brain,
  Check,
  CircleDot,
  Code2,
  ExternalLink,
  type LucideIcon,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Split,
  User,
  Zap,
} from "lucide-react";
import { type RefObject, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

type StepStatus = "queued" | "active" | "complete";

type SkillId =
  | "startup-goal"
  | "ceo"
  | "product-manager"
  | "cto"
  | "engineering-manager"
  | "founding-engineer"
  | "qa-lead";

interface SkillStep {
  skill: SkillId;
  label: string;
  owner: string;
  icon: LucideIcon;
  lines: string[];
  response: string;
  sourceUrl: string;
}

interface WorkflowCase {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  outcome: string;
  coordinator: SkillStep;
  roles: SkillStep[];
}

interface WorkflowCaseInput {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  outcome: string;
  coordinator: SkillStep;
  roles: readonly [SkillStep, ...SkillStep[]];
}

type RunPhase =
  | { kind: "intake" }
  | { kind: "approval" }
  | { kind: "dispatch" }
  | { kind: "collecting"; returnedRoleCount: number }
  | { kind: "synthesizing" }
  | { kind: "complete" };

type CheckpointId = "intake" | "approval" | "dispatch" | "collecting" | "complete";

interface Checkpoint {
  id: CheckpointId;
  label: string;
}

const CHECKPOINTS: readonly Checkpoint[] = [
  { id: "intake", label: "Intake" },
  { id: "approval", label: "Brief approval" },
  { id: "dispatch", label: "Route agents" },
  { id: "collecting", label: "Collect outputs" },
  { id: "complete", label: "Combined answer" },
];

const STARTUP_GOAL_SKILL_SOURCE =
  "https://github.com/devos-ing/omni-skills/blob/main/examples/teams/startup-team/skills/startup-goal/SKILL.md";
const ROLE_WORKFLOW_SOURCE_ROOT =
  "https://github.com/devos-ing/omni-skills/blob/main/examples/workflows";

const ROLE_PRESENTATION: Record<
  SkillId,
  Omit<SkillStep, "skill" | "lines" | "response" | "sourceUrl">
> = {
  "startup-goal": {
    label: "Route Goal",
    owner: "coordinator",
    icon: Split,
  },
  ceo: {
    label: "Strategy",
    owner: "CEO",
    icon: Brain,
  },
  "product-manager": {
    label: "Product Scope",
    owner: "PM",
    icon: MessageSquare,
  },
  cto: {
    label: "Architecture",
    owner: "CTO",
    icon: Code2,
  },
  "engineering-manager": {
    label: "Delivery",
    owner: "EM",
    icon: CircleDot,
  },
  "founding-engineer": {
    label: "Implementation",
    owner: "engineer",
    icon: Zap,
  },
  "qa-lead": {
    label: "QA Review",
    owner: "QA",
    icon: ShieldCheck,
  },
};

function skillSourceUrl(skill: SkillId) {
  return skill === "startup-goal"
    ? STARTUP_GOAL_SKILL_SOURCE
    : `${ROLE_WORKFLOW_SOURCE_ROOT}/${skill}/skills/${skill}/SKILL.md`;
}

function makeStep(skill: SkillId, lines: string[], response: string): SkillStep {
  return {
    skill,
    ...ROLE_PRESENTATION[skill],
    lines,
    response,
    sourceUrl: skillSourceUrl(skill),
  };
}

function defineWorkflowCase(input: WorkflowCaseInput): WorkflowCase {
  return {
    id: input.id,
    title: input.title,
    subtitle: input.subtitle,
    prompt: input.prompt,
    outcome: input.outcome,
    coordinator: input.coordinator,
    roles: [...input.roles],
  };
}

const WORKFLOW_CASES = [
  defineWorkflowCase({
    id: "idea-to-v1",
    title: "Idea to v1",
    subtitle: "Turn a fuzzy product idea into a shippable first slice.",
    prompt:
      "/startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
    outcome:
      "V1 plan ready: target solo founders first, prove receipt capture plus month-end summary, ship one onboarding path, and verify with five hands-on pilots.",
    coordinator: makeStep(
      "startup-goal",
      [
        "Ask which customer feels the bookkeeping pain weekly",
        "Draft approval brief with deadline and non-goals",
        "Route after the owner accepts the v1 scope",
      ],
      "Approved route: broad startup bench because customer, scope, architecture, delivery, and QA are all uncertain.",
    ),
    roles: [
      makeStep(
        "ceo",
        [
          "Choose solo founders as the first wedge",
          "Trade breadth for one painful money workflow",
          "Name learning speed as the company goal",
        ],
        "Direction: earn one narrow habit before claiming accounting automation.",
      ),
      makeStep(
        "product-manager",
        [
          "Write the user promise around receipt capture",
          "Define month-end summary acceptance criteria",
          "Cut dashboard polish and integrations from v1",
        ],
        "PRD slice: upload receipts, review categorized expenses, export a monthly summary.",
      ),
      makeStep(
        "cto",
        [
          "Keep OCR, categorization, and export behind seams",
          "Avoid bank integrations for the first proof",
          "Flag data-retention and audit-log requirements",
        ],
        "Architecture guardrail: validate the workflow with manual-friendly adapters before automating finance rails.",
      ),
      makeStep(
        "engineering-manager",
        [
          "Sequence prototype, pilot fixes, then export polish",
          "Reserve QA time for privacy and data-loss checks",
          "Hold launch until five pilots complete a month-end run",
        ],
        "Delivery plan: two-week slice with a midweek pilot checkpoint and a release gate.",
      ),
      makeStep(
        "founding-engineer",
        [
          "Build upload, category review, and summary export",
          "Instrument pilot feedback without fake analytics claims",
          "Keep edge cases visible in the review screen",
        ],
        "Implementation slice: one complete receipt-to-summary path, no bank sync.",
      ),
      makeStep(
        "qa-lead",
        [
          "Check corrupted uploads and duplicate receipts",
          "Verify exported totals against reviewed expenses",
          "Record residual risk around tax and compliance claims",
        ],
        "QA gate: release to pilots only after export totals, privacy copy, and recovery paths pass.",
      ),
    ],
  }),
  defineWorkflowCase({
    id: "pivot-or-focus",
    title: "Pivot or focus",
    subtitle: "Decide whether weak activation needs strategy, product, or delivery change.",
    prompt:
      "/startup-goal activation is weak; should we rebuild onboarding, narrow ICP, or add concierge setup?",
    outcome:
      "Decision log ready: pause the rebuild, narrow ICP to teams with urgent setup pain, run concierge onboarding for ten accounts, and measure time-to-first-value.",
    coordinator: makeStep(
      "startup-goal",
      [
        "Frame the goal as a go/no-go decision",
        "Ask for activation evidence and current ICP",
        "Route strategy, product, tech, delivery, and QA risk",
      ],
      "Approved route: decision-heavy goal, so CEO stays active and implementation waits for evidence.",
    ),
    roles: [
      makeStep(
        "ceo",
        [
          "Compare rebuild, narrower ICP, and concierge setup",
          "Reject feature velocity as the default answer",
          "Pick the option that teaches fastest this month",
        ],
        "Decision: narrow ICP plus concierge setup beats a broad onboarding rebuild.",
      ),
      makeStep(
        "product-manager",
        [
          "Define the activation moment as first useful project",
          "Find where new users lose confidence",
          "Write interview prompts for the next ten accounts",
        ],
        "Product test: measure time-to-first-value and reasons users need help.",
      ),
      makeStep(
        "cto",
        [
          "Check whether onboarding bugs block the chosen segment",
          "Avoid a platform rewrite during the learning sprint",
          "Expose manual setup hooks for concierge flow",
        ],
        "Technical call: support concierge setup with configuration hooks, not a new onboarding engine.",
      ),
      makeStep(
        "engineering-manager",
        [
          "Schedule a one-week evidence sprint",
          "Split work into copy, setup hooks, and support scripts",
          "Stop new scope until activation evidence is reviewed",
        ],
        "Delivery sequence: run concierge with tight feedback loops before committing engineering months.",
      ),
      makeStep(
        "founding-engineer",
        [
          "Add setup checklist visibility",
          "Create admin shortcuts for concierge configuration",
          "Log blockers during each assisted activation",
        ],
        "Implementation slice: lightweight setup tools that make the experiment observable.",
      ),
      makeStep(
        "qa-lead",
        [
          "Validate setup paths for the narrowed ICP",
          "Check that support scripts do not expose private data",
          "Define pass/fail thresholds for the experiment",
        ],
        "QA gate: ten accounts, clear activation metric, and no privacy regression.",
      ),
    ],
  }),
  defineWorkflowCase({
    id: "customer-request",
    title: "Customer request",
    subtitle: "Turn repeated user demand into a release without bloating scope.",
    prompt:
      "/startup-goal customers keep asking for team seats; turn that into a safe release plan",
    outcome:
      "Release plan ready: ship invite-only team seats for existing customers, defer billing changes, protect ownership transfer, and verify collaboration permissions.",
    coordinator: makeStep(
      "startup-goal",
      [
        "Clarify who requested team seats and why",
        "Name billing, permissions, and rollout gates",
        "Route because release safety spans every role",
      ],
      "Approved route: customer demand is real, but scope and permission risk need the full bench.",
    ),
    roles: [
      makeStep(
        "ceo",
        [
          "Keep expansion focused on existing customers",
          "Defer pricing change until usage proves value",
          "Avoid repositioning as enterprise too early",
        ],
        "Strategy: use team seats to deepen current accounts, not chase a new market.",
      ),
      makeStep(
        "product-manager",
        [
          "Define owner invites teammate to one workspace",
          "Write non-goals for billing, SSO, and org analytics",
          "Set acceptance around invite, revoke, and role visibility",
        ],
        "PRD slice: one workspace owner can invite and remove teammates with clear permissions.",
      ),
      makeStep(
        "cto",
        [
          "Review tenant boundaries and ownership transfer",
          "Model role permissions before UI work",
          "Flag audit events needed for support",
        ],
        "Architecture guardrail: permissions model first, billing integration later.",
      ),
      makeStep(
        "engineering-manager",
        [
          "Split into schema, permission checks, invite UI, and rollout",
          "Protect migration and rollback windows",
          "Reserve review time for cross-account leakage tests",
        ],
        "Delivery plan: small release behind a feature flag with explicit rollback.",
      ),
      makeStep(
        "founding-engineer",
        [
          "Implement invite tokens and member roles",
          "Guard all workspace reads with membership checks",
          "Add owner revoke and pending invite states",
        ],
        "Implementation slice: team seats without billing or SSO scope.",
      ),
      makeStep(
        "qa-lead",
        [
          "Test invite expiry, revoke, and duplicate invites",
          "Verify members cannot access other workspaces",
          "Check rollback leaves existing solo accounts untouched",
        ],
        "QA gate: permission matrix, invite lifecycle, and rollback smoke pass.",
      ),
    ],
  }),
] satisfies readonly WorkflowCase[];

const COORDINATOR_DELAY = 620;
const DISPATCH_DELAY = 720;
const ROLE_RETURN_DELAY = 720;
const SYNTHESIS_DELAY = 560;
const COMPLETE_PHASE: RunPhase = { kind: "complete" };

function getInitialPhase(reducedMotion: boolean): RunPhase {
  return reducedMotion ? COMPLETE_PHASE : { kind: "intake" };
}

function getActiveCheckpointIndex(phase: RunPhase): number {
  switch (phase.kind) {
    case "intake":
      return 0;
    case "approval":
      return 1;
    case "dispatch":
      return 2;
    case "collecting":
      return 3;
    case "synthesizing":
      return 4;
    case "complete":
      return CHECKPOINTS.length;
  }
}

function getCheckpointStatus(
  phase: RunPhase,
  checkpointIndex: number,
  roleCount: number,
): StepStatus {
  if (phase.kind === "collecting" && phase.returnedRoleCount >= roleCount) {
    return checkpointIndex <= 3 ? "complete" : "queued";
  }

  const activeIndex = getActiveCheckpointIndex(phase);
  if (checkpointIndex < activeIndex) return "complete";
  if (checkpointIndex === activeIndex) return "active";
  return "queued";
}

function showRoleBatch(phase: RunPhase): boolean {
  return (
    phase.kind === "dispatch" ||
    phase.kind === "collecting" ||
    phase.kind === "synthesizing" ||
    phase.kind === "complete"
  );
}

function getReturnedRoleCount(phase: RunPhase, roleCount: number): number {
  if (phase.kind === "collecting") {
    return Math.min(phase.returnedRoleCount, roleCount);
  }
  if (phase.kind === "synthesizing" || phase.kind === "complete") {
    return roleCount;
  }
  return 0;
}

function getRoleStatus(phase: RunPhase, roleIndex: number): StepStatus {
  if (!showRoleBatch(phase)) return "queued";
  if (phase.kind === "dispatch") return "active";
  if (phase.kind === "collecting") {
    return roleIndex < phase.returnedRoleCount ? "complete" : "active";
  }
  return "complete";
}

function getCoordinatorLineCount(phase: RunPhase): number {
  switch (phase.kind) {
    case "intake":
      return 1;
    case "approval":
      return 2;
    default:
      return 3;
  }
}

function isCoordinatorComplete(phase: RunPhase): boolean {
  return (
    phase.kind === "dispatch" ||
    phase.kind === "collecting" ||
    phase.kind === "synthesizing" ||
    phase.kind === "complete"
  );
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useLayoutEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

function SkillSourceLink({ role }: { role: SkillStep }) {
  return (
    <a
      href={role.sourceUrl}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${role.skill} skill source`}
      className="inline-flex items-center gap-1 rounded-md border border-[var(--rule)] bg-[#f0ede6]/20 px-1.5 py-0.5 font-mono text-xs text-[var(--body)] transition hover:border-[var(--muted)] hover:text-[#191817]/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e64b2e]/45"
    >
      {role.skill}
      <ExternalLink size={9} aria-hidden />
    </a>
  );
}

interface CaseRailProps {
  cases: readonly WorkflowCase[];
  selectedCaseIndex: number;
  onSelect: (caseIndex: number) => void;
}

function CaseRail({ cases, selectedCaseIndex, onSelect }: CaseRailProps) {
  return (
    <aside className="border-b border-[var(--rule)] bg-white p-3 lg:overflow-y-auto lg:border-b-0">
      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Cases</p>
      <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
        {cases.map((workflowCase, index) => {
          const isSelected = selectedCaseIndex === index;
          return (
            <button
              key={workflowCase.id}
              type="button"
              onClick={() => onSelect(index)}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "rounded-lg border border-[#e64b2e] bg-[#e64b2e]/10 px-3 py-2.5 text-left text-[#191817]/86 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e64b2e]/45"
                  : "rounded-lg border border-[var(--rule)] bg-white px-3 py-2.5 text-left text-[var(--body)] transition hover:border-[var(--muted)] hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e64b2e]/45"
              }
            >
              <span className="block text-xs font-medium">{workflowCase.title}</span>
              <span className="mt-1 block text-xs leading-4 text-[var(--muted)]">
                {workflowCase.subtitle}
              </span>
            </button>
          );
        })}
      </div>
    </aside>
  );
}

function CheckpointRail({ phase, roleCount }: { phase: RunPhase; roleCount: number }) {
  return (
    <aside className="border-t border-[var(--rule)] bg-white p-3 lg:overflow-y-auto lg:border-t-0">
      <p className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--muted)]">Checkpoints</p>
      <ol className="grid gap-2 sm:grid-cols-5 lg:grid-cols-1">
        {CHECKPOINTS.map((checkpoint, index) => {
          const status = getCheckpointStatus(phase, index, roleCount);
          return (
            <li
              key={checkpoint.id}
              data-status={status}
              className={
                status === "active"
                  ? "motion-active-role motion-progress relative overflow-hidden rounded-lg border border-[#e64b2e] bg-[#e64b2e]/[0.08] px-2.5 py-2"
                  : "motion-progress relative overflow-hidden rounded-lg border border-[var(--rule)] bg-white px-2.5 py-2"
              }
            >
              <span className="flex items-center gap-1.5 text-xs font-medium text-[#191817]/68">
                {status === "complete" ? <Check size={11} aria-hidden /> : null}
                {checkpoint.label}
              </span>
              <span className="mt-1 block text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                {status}
              </span>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

interface ChatTranscriptProps {
  workflowCase: WorkflowCase;
  phase: RunPhase;
  scrollRef: RefObject<HTMLDivElement | null>;
  onReplay: () => void;
}

function ChatTranscript({ workflowCase, phase, scrollRef, onReplay }: ChatTranscriptProps) {
  const isDone = phase.kind === "complete";
  const coordinatorLineCount = getCoordinatorLineCount(phase);
  const coordinatorComplete = isCoordinatorComplete(phase);
  const returnedRoleCount = getReturnedRoleCount(phase, workflowCase.roles.length);
  const returnedRoles = workflowCase.roles.slice(0, returnedRoleCount);

  return (
    <section className="flex h-[34rem] min-w-0 flex-col border-y border-[var(--rule)] lg:h-full lg:border-x lg:border-y-0 overflow-y-scroll">
      <div className="flex items-center justify-between border-b border-[var(--rule)] bg-white px-3 py-2.5">
        <span className="font-mono text-xs text-[var(--muted)]">agent-workbench/startup-goal</span>
        <button
          type="button"
          onClick={onReplay}
          className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--rule)] text-[var(--muted)] transition hover:border-[var(--muted)] hover:text-[#191817]/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#e64b2e]/45"
          aria-label="Replay startup goal demo"
          title="Replay"
        >
          <RotateCcw size={13} />
        </button>
      </div>

      <div className="border-b border-[var(--rule)] bg-white px-3 py-2.5">
        <span className="text-xs font-medium text-[#191817]/76">{workflowCase.title}</span>
        <span className="ml-2 text-xs text-[var(--muted)]">{workflowCase.subtitle}</span>
      </div>

      <div
        ref={scrollRef}
        aria-live="polite"
        aria-atomic="false"
        className="min-h-0 flex-1 space-y-3 p-3 sm:p-4 overflow-y-auto"
      >
        <div className="flex gap-2.5">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white text-[var(--body)]">
            <User size={13} />
          </span>
          <div className="min-w-0 rounded-lg border border-[var(--rule)] bg-white px-2.5 py-2">
            <p className="mb-1 text-xs text-[var(--muted)]">You</p>
            <p className="break-words font-mono text-xs leading-5 text-[#191817]/76">
              {workflowCase.prompt}
            </p>
          </div>
        </div>

        <div className="demo-message flex gap-2.5 motion-safe:animate-[agent-message_200ms_var(--ease-out)_both]">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#e64b2e] bg-[#e64b2e]/10 text-[#c83c24]">
            <Split size={13} />
          </span>
          <div className="min-w-0 flex-1 rounded-lg border border-[#e64b2e] bg-[#e64b2e]/[0.07] px-2.5 py-2">
            <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
              <span className="text-xs text-[#c83c24]">{workflowCase.coordinator.owner}</span>
              <SkillSourceLink role={workflowCase.coordinator} />
            </div>
            <div className="space-y-1">
              {workflowCase.coordinator.lines.slice(0, coordinatorLineCount).map((line) => (
                <p key={line} className="text-xs leading-5 text-[var(--body)]">
                  {line}
                </p>
              ))}
            </div>
            {coordinatorComplete ? (
              <p className="mt-1.5 border-t border-[var(--rule)] pt-1.5 text-xs leading-5 text-[#191817]/66">
                {workflowCase.coordinator.response}
              </p>
            ) : null}
          </div>
        </div>

        {showRoleBatch(phase) ? (
          <div className="rounded-lg border border-[var(--rule)] bg-white px-2.5 py-2 demo-message motion-safe:animate-[agent-message_200ms_var(--ease-out)_both]">
            <p className="mb-2 text-xs text-[var(--body)]">Role agents started working together</p>
            <div className="flex flex-wrap gap-1.5">
              {workflowCase.roles.map((role, index) => {
                const status = getRoleStatus(phase, index);
                return (
                  <span
                    key={role.skill}
                    data-status={status}
                    className={`motion-progress relative inline-flex items-center gap-1.5 overflow-hidden rounded-md border border-[var(--rule)] bg-[#f0ede6]/20 px-1.5 py-1 ${status === "active" ? "motion-active-role" : ""}`}
                  >
                    <SkillSourceLink role={role} />
                    <span className="text-xs uppercase tracking-[0.12em] text-[var(--muted)]">
                      {status}
                    </span>
                  </span>
                );
              })}
            </div>
          </div>
        ) : null}

        {returnedRoles.map((role) => {
          const Icon = role.icon;
          return (
            <div
              key={`returned-${role.skill}`}
              className="flex gap-2.5 demo-message motion-safe:animate-[agent-message_200ms_var(--ease-out)_both]"
            >
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[var(--rule)] bg-white text-[var(--body)]">
                <Icon size={13} />
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-[var(--rule)] bg-white px-2.5 py-2">
                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                  <span className="text-xs font-medium text-[#191817]/64">{role.owner}</span>
                  <SkillSourceLink role={role} />
                  <span className="text-xs text-[var(--muted)]">returned</span>
                </div>
                <p className="text-xs leading-5 text-[#191817]/66">{role.response}</p>
              </div>
            </div>
          );
        })}

        {phase.kind === "synthesizing" ? (
          <div className="rounded-lg border border-[#e64b2e] bg-[#e64b2e]/[0.07] px-2.5 py-2 text-xs text-[var(--body)]">
            Combining role outputs into one owner-facing answer
          </div>
        ) : null}

        {isDone ? (
          <div className="flex gap-2.5 demo-message motion-safe:animate-[agent-message_200ms_var(--ease-out)_both]">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-[#e64b2e] bg-[#e64b2e]/10 text-[#c83c24]">
              <Sparkles size={13} />
            </span>
            <div className="min-w-0 flex-1 rounded-lg border border-[#e64b2e] bg-[#e64b2e]/[0.07] px-2.5 py-2">
              <p className="mb-1 text-xs text-[#c83c24]">Combined answer</p>
              <p className="text-xs leading-5 text-[#191817]/72">{workflowCase.outcome}</p>
            </div>
          </div>
        ) : null}
      </div>

      <div className="border-t border-[var(--rule)] bg-white p-2.5">
        <div className="rounded-lg border border-[var(--rule)] bg-[#f0ede6]/30 px-2.5 py-1.5 font-mono text-xs text-[var(--muted)]">
          {isDone ? "approve next action or ask a role to revise" : "sub-agents streaming"}
        </div>
      </div>
    </section>
  );
}

export function WorkflowRunDemo() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [hasEnteredViewport, setHasEnteredViewport] = useState(false);
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const activeCase = WORKFLOW_CASES[selectedCaseIndex] ?? WORKFLOW_CASES[0];
  const [phase, setPhase] = useState<RunPhase>(() => getInitialPhase(prefersReducedMotion));
  const renderedPhase = prefersReducedMotion ? COMPLETE_PHASE : phase;
  const scrollRef = useRef<HTMLDivElement>(null);
  const workbenchRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  const reset = useCallback(() => {
    clearTimer();
    setPhase(getInitialPhase(prefersReducedMotion));
  }, [clearTimer, prefersReducedMotion]);

  const selectCase = useCallback(
    (caseIndex: number) => {
      clearTimer();
      setSelectedCaseIndex(caseIndex);
      setPhase(getInitialPhase(prefersReducedMotion));
    },
    [clearTimer, prefersReducedMotion],
  );

  useEffect(() => {
    if (!prefersReducedMotion) return;
    clearTimer();
    setPhase(COMPLETE_PHASE);
  }, [clearTimer, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion) return;
    const workbench = workbenchRef.current;

    if (!workbench || !("IntersectionObserver" in window)) {
      setHasEnteredViewport(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        setHasEnteredViewport(true);
        observer.disconnect();
      },
      { rootMargin: "0px 0px -12%", threshold: 0.15 },
    );

    observer.observe(workbench);
    return () => observer.disconnect();
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (!hasEnteredViewport || prefersReducedMotion || phase.kind === "complete") return undefined;

    const schedule = (nextPhase: RunPhase, delay: number) => {
      clearTimer();
      timerRef.current = setTimeout(() => setPhase(nextPhase), delay);
    };

    switch (phase.kind) {
      case "intake":
        schedule({ kind: "approval" }, COORDINATOR_DELAY);
        break;
      case "approval":
        schedule({ kind: "dispatch" }, COORDINATOR_DELAY);
        break;
      case "dispatch":
        schedule({ kind: "collecting", returnedRoleCount: 0 }, DISPATCH_DELAY);
        break;
      case "collecting":
        if (phase.returnedRoleCount < activeCase.roles.length) {
          schedule(
            { kind: "collecting", returnedRoleCount: phase.returnedRoleCount + 1 },
            ROLE_RETURN_DELAY,
          );
        } else {
          schedule({ kind: "synthesizing" }, SYNTHESIS_DELAY);
        }
        break;
      case "synthesizing":
        schedule({ kind: "complete" }, SYNTHESIS_DELAY);
        break;
    }

    return () => {
      clearTimer();
    };
  }, [activeCase.roles.length, clearTimer, hasEnteredViewport, phase, prefersReducedMotion]);

  // The transcript content changes on every run phase even though phase is not read in the body.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll after each phase transition
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "auto",
    });
  }, [phase, prefersReducedMotion]);

  return (
    <div ref={workbenchRef} id="workflow-run" className="motion-workbench">
      <div className="overflow-hidden rounded-lg border border-[#dedbd3] bg-white shadow-[0_20px_60px_rgb(25_24_23/0.08)] lg:h-[36rem]">
        <div className="grid lg:h-full lg:grid-cols-[13rem_minmax(0,1fr)_13rem] lg:overflow-hidden">
          <CaseRail
            cases={WORKFLOW_CASES}
            selectedCaseIndex={selectedCaseIndex}
            onSelect={selectCase}
          />
          <ChatTranscript
            workflowCase={activeCase}
            phase={renderedPhase}
            scrollRef={scrollRef}
            onReplay={reset}
          />
          <CheckpointRail phase={renderedPhase} roleCount={activeCase.roles.length} />
        </div>
      </div>
    </div>
  );
}
