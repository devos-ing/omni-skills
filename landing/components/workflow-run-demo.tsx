"use client";

import {
  Bot,
  Brain,
  Check,
  ChevronRight,
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
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type StepStatus = "queued" | "active" | "complete";

interface SkillStep {
  skill: SkillId;
  label: string;
  owner: string;
  icon: LucideIcon;
  lines: string[];
  response: string;
  sourceUrl: string;
}

type SkillId =
  | "startup-goal"
  | "ceo"
  | "product-manager"
  | "cto"
  | "engineering-manager"
  | "founding-engineer"
  | "qa-lead";

interface ProcessPoint {
  label: string;
  value: string;
}

interface WorkflowCase {
  id: string;
  title: string;
  subtitle: string;
  prompt: string;
  outcome: string;
  processPoints: ProcessPoint[];
  steps: SkillStep[];
}

interface TranscriptEntry {
  step: SkillStep;
  lines: string[];
  complete: boolean;
  showChecklist: boolean;
}

const STARTUP_GOAL_SKILL_SOURCE_ROOT =
  "https://github.com/0xroylee/getsuperpower/blob/main/examples/workflows/startup-goal/skills";

function skillSourceUrl(skill: string) {
  return `${STARTUP_GOAL_SKILL_SOURCE_ROOT}/${skill}/SKILL.md`;
}

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

const ACTIVE_ACCENT = {
  border: "border-violet-300/30",
  bg: "bg-violet-400/[0.08]",
  color: "text-violet-100/82",
  shadow: "shadow-violet-500/10",
};

function makeStep(skill: SkillId, lines: string[], response: string): SkillStep {
  return {
    skill,
    ...ROLE_PRESENTATION[skill],
    lines,
    response,
    sourceUrl: skillSourceUrl(skill),
  };
}

const WORKFLOW_CASES: WorkflowCase[] = [
  {
    id: "idea-to-v1",
    title: "Idea to v1",
    subtitle: "Turn a fuzzy product idea into a shippable first slice.",
    prompt:
      "/startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
    outcome:
      "V1 plan ready: target solo founders first, prove receipt capture plus month-end summary, ship one onboarding path, and verify with five hands-on pilots.",
    processPoints: [
      { label: "Intake", value: "clarify customer and deadline" },
      { label: "Approval", value: "lock a narrow v1 brief" },
      { label: "Routing", value: "use full operating bench" },
      { label: "Handoff", value: "merge role outputs" },
    ],
    steps: [
      makeStep(
        "startup-goal",
        [
          "Ask which customer feels the bookkeeping pain weekly",
          "Draft approval brief with deadline and non-goals",
          "Route after the owner accepts the v1 scope",
        ],
        "Approved route: broad startup bench because customer, scope, architecture, delivery, and QA are all uncertain.",
      ),
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
  },
  {
    id: "pivot-or-focus",
    title: "Pivot or focus",
    subtitle: "Decide whether weak activation needs strategy, product, or delivery change.",
    prompt:
      "/startup-goal activation is weak; should we rebuild onboarding, narrow ICP, or add concierge setup?",
    outcome:
      "Decision log ready: pause the rebuild, narrow ICP to teams with urgent setup pain, run concierge onboarding for ten accounts, and measure time-to-first-value.",
    processPoints: [
      { label: "Intake", value: "separate symptoms from causes" },
      { label: "Decision", value: "compare three strategic paths" },
      { label: "Roles", value: "CEO, PM, CTO, EM, QA pressure-test" },
      { label: "Gate", value: "ship after evidence improves" },
    ],
    steps: [
      makeStep(
        "startup-goal",
        [
          "Frame the goal as a go/no-go decision",
          "Ask for activation evidence and current ICP",
          "Route strategy, product, tech, delivery, and QA risk",
        ],
        "Approved route: decision-heavy goal, so CEO stays active and implementation waits for evidence.",
      ),
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
  },
  {
    id: "customer-request",
    title: "Customer request",
    subtitle: "Turn repeated user demand into a release without bloating scope.",
    prompt:
      "/startup-goal customers keep asking for team seats; turn that into a safe release plan",
    outcome:
      "Release plan ready: ship invite-only team seats for existing customers, defer billing changes, protect ownership transfer, and verify collaboration permissions.",
    processPoints: [
      { label: "Intake", value: "confirm demand and non-goals" },
      { label: "Scope", value: "seat invites before billing" },
      { label: "Risk", value: "permissions and ownership" },
      { label: "Release", value: "acceptance plus rollback" },
    ],
    steps: [
      makeStep(
        "startup-goal",
        [
          "Clarify who requested team seats and why",
          "Name billing, permissions, and rollout gates",
          "Route because release safety spans every role",
        ],
        "Approved route: customer demand is real, but scope and permission risk need the full bench.",
      ),
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
  },
];
const TYPE_DELAY = 18;
const LINE_DELAY = 360;
const BETWEEN_STEPS = 720;

type Phase =
  | { kind: "typing"; charIndex: number }
  | { kind: "running"; stepIndex: number; lineIndex: number; done: boolean };

function getDonePhase(steps: SkillStep[]): Phase {
  const lastStep = steps.at(-1);
  return {
    kind: "running",
    stepIndex: Math.max(steps.length - 1, 0),
    lineIndex: lastStep?.lines.length ?? 0,
    done: true,
  };
}

function getStepStatus(phase: Phase, index: number, completedSteps: number[]): StepStatus {
  if (completedSteps.includes(index)) return "complete";
  if (phase.kind === "running" && phase.stepIndex === index && !phase.done) return "active";
  return "queued";
}

function makeTranscriptEntry(step: SkillStep, lines: string[], complete: boolean): TranscriptEntry {
  return {
    step,
    lines,
    complete,
    showChecklist: !complete,
  };
}

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduced;
}

export function WorkflowRunDemo() {
  const prefersReducedMotion = usePrefersReducedMotion();
  const [selectedCaseIndex, setSelectedCaseIndex] = useState(0);
  const activeCase = WORKFLOW_CASES[selectedCaseIndex] ?? WORKFLOW_CASES[0];
  const steps = activeCase.steps;
  const [phase, setPhase] = useState<Phase>(() =>
    prefersReducedMotion ? getDonePhase(WORKFLOW_CASES[0].steps) : { kind: "typing", charIndex: 0 },
  );
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [selectedStepIndex, setSelectedStepIndex] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = useCallback(
    (caseIndex = selectedCaseIndex) => {
      const demoCase = WORKFLOW_CASES[caseIndex] ?? WORKFLOW_CASES[0];
      const nextSteps = demoCase.steps;

      setSelectedStepIndex(0);

      if (timerRef.current) clearTimeout(timerRef.current);
      if (prefersReducedMotion) {
        setCompletedSteps(nextSteps.map((_, index) => index));
        setPhase(getDonePhase(nextSteps));
        return;
      }

      setCompletedSteps([]);
      setPhase({ kind: "typing", charIndex: 0 });
    },
    [prefersReducedMotion, selectedCaseIndex],
  );

  const selectCase = (caseIndex: number) => {
    setSelectedCaseIndex(caseIndex);
    reset(caseIndex);
  };

  useEffect(() => {
    if (!prefersReducedMotion) return;
    setCompletedSteps(steps.map((_, index) => index));
    setPhase(getDonePhase(steps));
  }, [prefersReducedMotion, steps]);

  useEffect(() => {
    if (prefersReducedMotion || phase.kind !== "typing") return undefined;

    if (phase.charIndex < activeCase.prompt.length) {
      timerRef.current = setTimeout(
        () => setPhase({ kind: "typing", charIndex: phase.charIndex + 1 }),
        TYPE_DELAY,
      );
    } else {
      timerRef.current = setTimeout(
        () => setPhase({ kind: "running", stepIndex: 0, lineIndex: 0, done: false }),
        420,
      );
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeCase.prompt, phase, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || phase.kind !== "running" || phase.done) return undefined;

    const step = steps[phase.stepIndex];
    if (!step) return undefined;

    if (phase.lineIndex < step.lines.length) {
      timerRef.current = setTimeout(
        () => setPhase({ ...phase, lineIndex: phase.lineIndex + 1 }),
        LINE_DELAY,
      );
    } else {
      setCompletedSteps((current) =>
        current.includes(phase.stepIndex) ? current : [...current, phase.stepIndex],
      );
      const next = phase.stepIndex + 1;
      if (next < steps.length) {
        timerRef.current = setTimeout(
          () => setPhase({ kind: "running", stepIndex: next, lineIndex: 0, done: false }),
          BETWEEN_STEPS,
        );
      } else {
        setPhase({ ...phase, done: true });
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase, prefersReducedMotion, steps]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  });

  const isDone = phase.kind === "running" && phase.done;
  const isTyping = phase.kind === "typing";
  const typedPrompt =
    phase.kind === "typing" ? activeCase.prompt.slice(0, phase.charIndex) : activeCase.prompt;
  const selectedStep = steps[selectedStepIndex] ?? steps[0];
  const SelectedIcon = selectedStep.icon;
  const selectedStepStatus = getStepStatus(phase, selectedStepIndex, completedSteps);

  const visibleTranscript = useMemo(() => {
    if (phase.kind === "typing") return [];

    const transcript = completedSteps.flatMap((stepIndex) => {
      const step = steps[stepIndex];
      return step ? [makeTranscriptEntry(step, step.lines, true)] : [];
    });

    const activeStep = steps[phase.stepIndex];
    if (!phase.done && activeStep && !completedSteps.includes(phase.stepIndex)) {
      transcript.push(
        makeTranscriptEntry(activeStep, activeStep.lines.slice(0, phase.lineIndex), false),
      );
    }

    return transcript;
  }, [completedSteps, phase, steps]);

  return (
    <div id="workflow-run" className="space-y-3">
      <div>
        <p className="mb-2 text-[10px] uppercase tracking-[0.18em] text-white/32">
          Case categories
        </p>
        <div className="grid gap-2 sm:grid-cols-3">
          {WORKFLOW_CASES.map((workflowCase, index) => {
            const isSelected = selectedCaseIndex === index;
            return (
              <button
                key={workflowCase.id}
                type="button"
                onClick={() => selectCase(index)}
                aria-pressed={isSelected}
                className={`rounded-lg border px-3 py-2.5 text-left transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
                  isSelected
                    ? "border-violet-300/35 bg-violet-400/10 text-white/86"
                    : "border-white/[0.08] bg-white/[0.025] text-white/45 hover:border-white/16 hover:bg-white/[0.04]"
                }`}
              >
                <span className="block text-xs font-medium">{workflowCase.title}</span>
                <span className="mt-1 block text-[11px] leading-4 text-white/38">
                  {workflowCase.subtitle}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[44rem] overflow-hidden rounded-lg border border-white/[0.08] bg-[#090909] shadow-2xl shadow-black/40 lg:h-[34rem]">
        <div className="grid h-full overflow-y-auto lg:grid-cols-[18rem_minmax(0,1fr)] lg:overflow-hidden">
          <aside className="overflow-y-auto border-b border-white/[0.06] bg-white/[0.018] p-4 lg:border-b-0 lg:border-r">
            <div className="mb-4 flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">Processing</p>
                <h3 className="mt-1 text-xs font-medium text-white/80">Run calls</h3>
              </div>
              <button
                type="button"
                onClick={() => reset()}
                className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/35 transition hover:border-white/20 hover:text-white/70"
                aria-label="Replay startup goal demo"
                title="Replay"
              >
                <RotateCcw size={13} />
              </button>
            </div>

            <div className="space-y-2">
              {steps.map((step, index) => {
                const status = getStepStatus(phase, index, completedSteps);
                const Icon = step.icon;
                const isSelected = selectedStepIndex === index;
                return (
                  <button
                    key={step.skill}
                    type="button"
                    onClick={() => setSelectedStepIndex(index)}
                    aria-label={`View ${step.skill} skill`}
                    aria-pressed={isSelected}
                    aria-controls="selected-skill-preview"
                    className={`group relative w-full overflow-hidden rounded-lg border px-3 py-2.5 text-left transition-all duration-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/45 ${
                      status === "active"
                        ? `${ACTIVE_ACCENT.border} ${ACTIVE_ACCENT.bg} shadow-lg ${ACTIVE_ACCENT.shadow}`
                        : status === "complete"
                          ? "border-white/[0.10] bg-white/[0.035]"
                          : "border-white/[0.06] bg-transparent"
                    } ${isSelected ? "ring-1 ring-violet-200/28" : ""} ${
                      isSelected && status === "queued" ? "bg-white/[0.025]" : ""
                    }`}
                  >
                    <div className="relative z-10 flex items-center gap-2">
                      <span
                        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                          status === "queued"
                            ? "border-white/[0.06] text-white/18"
                            : status === "active"
                              ? `${ACTIVE_ACCENT.border} ${ACTIVE_ACCENT.color}`
                              : "border-white/[0.10] text-white/48"
                        }`}
                      >
                        {status === "complete" ? <Check size={13} /> : <Icon size={13} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center justify-between gap-2">
                          <span className="truncate text-[11px] font-medium text-white/74">
                            {step.label}
                          </span>
                          <span
                            className={`shrink-0 text-[9px] uppercase tracking-[0.12em] ${
                              status === "active"
                                ? ACTIVE_ACCENT.color
                                : status === "complete"
                                  ? "text-white/42"
                                  : "text-white/18"
                            }`}
                          >
                            {status}
                          </span>
                        </span>
                        <span className="mt-0.5 flex items-center justify-between gap-2">
                          <code className="truncate font-mono text-[10px] text-white/32">
                            {step.skill}
                          </code>
                          <span className="shrink-0 text-[10px] text-white/26">{step.owner}</span>
                        </span>
                      </span>
                    </div>
                    {status === "active" ? (
                      <span className="absolute inset-x-0 bottom-0 h-px bg-current opacity-60 motion-safe:animate-pulse" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <div
              id="selected-skill-preview"
              className="mt-4 rounded-lg border border-white/[0.08] bg-white/[0.025] p-3.5"
            >
              <p className="mb-2 text-[10px] uppercase tracking-[0.16em] text-white/30">
                Selected skill
              </p>
              <div className="mb-2 flex items-center gap-2">
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                    selectedStepStatus === "active"
                      ? `${ACTIVE_ACCENT.border} ${ACTIVE_ACCENT.color}`
                      : "border-white/[0.08] text-white/54"
                  }`}
                >
                  <SelectedIcon size={13} />
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-medium text-white/78">
                    {selectedStep.label}
                  </span>
                  <code className="block truncate font-mono text-[10px] text-white/42">
                    {selectedStep.skill}
                  </code>
                </span>
              </div>
              <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                <span className="rounded bg-black/25 px-1.5 py-0.5 text-white/42">
                  owner: {selectedStep.owner}
                </span>
                <span className="rounded bg-black/25 px-1.5 py-0.5 text-white/42">
                  status: {selectedStepStatus}
                </span>
              </div>
              <div className="mb-2 space-y-1">
                {selectedStep.lines.map((line) => (
                  <div key={line} className="flex gap-1.5 text-[11px] leading-5 text-white/48">
                    <ChevronRight size={11} className="mt-1 shrink-0 text-white/22" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
              <p className="text-[11px] leading-5 text-white/52">{selectedStep.response}</p>
              <a
                href={selectedStep.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="mt-2 inline-flex items-center gap-1.5 rounded-md border border-white/10 px-2 py-1 text-[10px] text-violet-100/68 transition hover:border-white/20 hover:text-white/82"
              >
                View skill source
                <ExternalLink size={11} />
              </a>
            </div>
          </aside>

          <div className="flex min-h-[28rem] flex-col border-b border-white/[0.06] lg:min-h-0 lg:border-b-0">
            <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-white/28" />
                <span className="h-2 w-2 rounded-full bg-white/18" />
                <span className="h-2 w-2 rounded-full bg-white/12" />
              </div>
              <span className="font-mono text-[11px] text-white/28">
                agent-workbench/startup-goal
              </span>
              <span className="text-[10px] text-white/20">{isDone ? "done" : "running"}</span>
            </div>

            <div className="border-b border-white/[0.06] bg-white/[0.015] px-3 py-2.5 sm:px-4">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="text-[10px] uppercase tracking-[0.16em] text-white/24">Case</span>
                <span className="text-xs font-medium text-white/76">{activeCase.title}</span>
                <span className="text-xs leading-5 text-white/38">{activeCase.subtitle}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {activeCase.processPoints.map((point) => (
                  <span
                    key={`${point.label}-${point.value}`}
                    className="inline-flex max-w-full items-center gap-1.5 rounded-md border border-white/[0.08] bg-black/25 px-2 py-1 text-[10px]"
                  >
                    <span className="shrink-0 uppercase tracking-[0.12em] text-violet-100/45">
                      {point.label}
                    </span>
                    <span className="truncate text-white/45">{point.value}</span>
                  </span>
                ))}
              </div>
            </div>

            <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3 sm:p-4">
              <div className="flex gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/[0.06] text-white/50">
                  <User size={13} />
                </span>
                <div className="min-w-0 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-2">
                  <p className="mb-1 text-[11px] text-white/28">You</p>
                  <p className="break-words font-mono text-xs leading-5 text-white/76">
                    {typedPrompt}
                    {isTyping ? (
                      <span className="ml-0.5 inline-block h-3.5 w-1 animate-pulse bg-white/65 align-middle" />
                    ) : null}
                  </p>
                </div>
              </div>

              {phase.kind !== "typing" ? (
                <div className="flex gap-2.5">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-violet-300/20 bg-violet-400/10 text-violet-200">
                    <Bot size={13} />
                  </span>
                  <div className="min-w-0 rounded-lg border border-violet-300/15 bg-violet-400/[0.07] px-2.5 py-2">
                    <p className="mb-1 text-[11px] text-violet-100/40">System</p>
                    <p className="text-xs leading-5 text-white/62">
                      Recognized <code className="text-violet-100/75">startup-goal</code>. Starting
                      requirement intake, approval brief, lazy routing, and role handoffs.
                    </p>
                  </div>
                </div>
              ) : null}

              {visibleTranscript.map(({ step, lines, complete, showChecklist }) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.skill}
                    className="flex gap-2.5 motion-safe:animate-[agent-message_360ms_ease-out_both]"
                  >
                    <span
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        showChecklist
                          ? `${ACTIVE_ACCENT.border} ${ACTIVE_ACCENT.bg} ${ACTIVE_ACCENT.color}`
                          : "border-white/[0.08] bg-white/[0.035] text-white/48"
                      }`}
                    >
                      <Icon size={13} />
                    </span>
                    <div className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
                      <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-medium text-white/64">{step.owner}</span>
                        <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-white/32">
                          {step.skill}
                        </code>
                        {complete ? (
                          <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/42">
                            <Check size={10} />
                            returned
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded bg-violet-400/10 px-1.5 py-0.5 text-[10px] text-violet-100/62">
                            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                            thinking
                          </span>
                        )}
                      </div>
                      {showChecklist ? (
                        <div className="space-y-1">
                          {lines.map((line) => (
                            <div
                              key={line}
                              className="flex gap-1.5 text-xs leading-5 text-white/46"
                            >
                              <ChevronRight size={12} className="mt-1 shrink-0 text-white/20" />
                              <span>{line}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                      {complete ? (
                        <p
                          className={`text-xs leading-5 text-white/66 ${
                            showChecklist ? "mt-1.5 border-t border-white/[0.06] pt-1.5" : ""
                          }`}
                        >
                          {step.response}
                        </p>
                      ) : (
                        <span className="mt-2 inline-block h-3 w-1.5 animate-pulse bg-white/25 align-middle" />
                      )}
                    </div>
                  </div>
                );
              })}

              {isDone ? (
                <div className="flex gap-2.5 motion-safe:animate-[agent-message_360ms_ease-out_both]">
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-violet-300/24 bg-violet-400/10 text-violet-100/82">
                    <Sparkles size={13} />
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-violet-300/16 bg-violet-400/[0.07] px-2.5 py-2">
                    <p className="mb-1 text-[11px] text-violet-100/45">Combined answer</p>
                    <p className="text-xs leading-5 text-white/72">{activeCase.outcome}</p>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="border-t border-white/[0.06] bg-white/[0.018] p-2.5">
              <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/30 px-2.5 py-1.5 font-mono text-[11px] text-white/34">
                <span className="text-violet-200/70">&gt;</span>
                <span className="truncate">
                  {isDone ? "approve next action or ask a role to revise" : "sub-agents streaming"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
