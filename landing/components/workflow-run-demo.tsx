"use client";

import {
  Bot,
  Brain,
  Check,
  ChevronRight,
  CircleDot,
  Code2,
  type LucideIcon,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Split,
  User,
  Zap,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type StepStatus = "queued" | "active" | "complete";

interface SkillStep {
  skill: string;
  label: string;
  owner: string;
  icon: LucideIcon;
  color: string;
  border: string;
  bg: string;
  shadow: string;
  lines: string[];
  response: string;
}

const STEPS: SkillStep[] = [
  {
    skill: "startup-goal",
    label: "Route Goal",
    owner: "coordinator",
    icon: Split,
    color: "text-violet-200",
    border: "border-violet-300/25",
    bg: "bg-violet-400/10",
    shadow: "shadow-violet-500/20",
    lines: [
      "Parse owner goal and approval gate",
      "Load bundled role skills",
      "Dispatch role-scoped sub-agents",
    ],
    response: "Routing plan created with six accountable roles.",
  },
  {
    skill: "ceo",
    label: "Strategy",
    owner: "CEO",
    icon: Brain,
    color: "text-sky-200",
    border: "border-sky-300/25",
    bg: "bg-sky-400/10",
    shadow: "shadow-sky-500/20",
    lines: [
      "Clarify wedge and customer pain",
      "Name the tradeoff",
      "Choose learning speed over breadth",
    ],
    response: "Launch learning wins; keep the first version narrow and painful.",
  },
  {
    skill: "product-manager",
    label: "Product Scope",
    owner: "PM",
    icon: MessageSquare,
    color: "text-amber-200",
    border: "border-amber-300/25",
    bg: "bg-amber-400/10",
    shadow: "shadow-amber-500/20",
    lines: [
      "Translate strategy into a user promise",
      "Write acceptance criteria",
      "Slice the first demo path",
    ],
    response: "Ship one compelling workflow path before broad catalog polish.",
  },
  {
    skill: "cto",
    label: "Architecture",
    owner: "CTO",
    icon: Code2,
    color: "text-cyan-200",
    border: "border-cyan-300/25",
    bg: "bg-cyan-400/10",
    shadow: "shadow-cyan-500/20",
    lines: [
      "Check manifest and install boundaries",
      "Separate browser demo from runtime state",
      "Flag dependency and build risk",
    ],
    response: "Keep the landing demo client-only; runtime contracts stay in the CLI.",
  },
  {
    skill: "engineering-manager",
    label: "Delivery",
    owner: "EM",
    icon: CircleDot,
    color: "text-lime-200",
    border: "border-lime-300/25",
    bg: "bg-lime-400/10",
    shadow: "shadow-lime-500/20",
    lines: [
      "Sequence visible UI first",
      "Keep tests focused on source contracts",
      "Hold the full check gate for merge",
    ],
    response: "Deliver the demo as a bounded landing component change.",
  },
  {
    skill: "founding-engineer",
    label: "Implementation",
    owner: "engineer",
    icon: Zap,
    color: "text-emerald-200",
    border: "border-emerald-300/25",
    bg: "bg-emerald-400/10",
    shadow: "shadow-emerald-500/20",
    lines: [
      "Update the workbench surface",
      "Preserve the simulated-run copy",
      "Verify desktop and mobile fit",
    ],
    response: "Smallest shippable slice: animated transcript plus role status rail.",
  },
  {
    skill: "qa-lead",
    label: "QA Review",
    owner: "QA",
    icon: ShieldCheck,
    color: "text-rose-200",
    border: "border-rose-300/25",
    bg: "bg-rose-400/10",
    shadow: "shadow-rose-500/20",
    lines: [
      "Check acceptance against the goal",
      "Verify no fake telemetry appears",
      "Call out residual launch risk",
    ],
    response: "Release when the source contract, build, and reduced-motion view pass.",
  },
];

const PROMPT = "/startup-goal help me launch this product from idea to shipped v1";
const TYPE_DELAY = 18;
const LINE_DELAY = 360;
const BETWEEN_STEPS = 720;

type Phase =
  | { kind: "typing"; charIndex: number }
  | { kind: "running"; stepIndex: number; lineIndex: number; done: boolean };

function getStepStatus(phase: Phase, index: number, completedSteps: number[]): StepStatus {
  if (completedSteps.includes(index)) return "complete";
  if (phase.kind === "running" && phase.stepIndex === index && !phase.done) return "active";
  return "queued";
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
  const [phase, setPhase] = useState<Phase>(() =>
    prefersReducedMotion
      ? {
          kind: "running",
          stepIndex: STEPS.length - 1,
          lineIndex: STEPS.at(-1)?.lines.length ?? 0,
          done: true,
        }
      : { kind: "typing", charIndex: 0 },
  );
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (prefersReducedMotion) {
      setCompletedSteps(STEPS.map((_, index) => index));
      setPhase({
        kind: "running",
        stepIndex: STEPS.length - 1,
        lineIndex: STEPS.at(-1)?.lines.length ?? 0,
        done: true,
      });
      return;
    }

    setCompletedSteps([]);
    setPhase({ kind: "typing", charIndex: 0 });
  };

  useEffect(() => {
    if (!prefersReducedMotion) return;
    setCompletedSteps(STEPS.map((_, index) => index));
    setPhase({
      kind: "running",
      stepIndex: STEPS.length - 1,
      lineIndex: STEPS.at(-1)?.lines.length ?? 0,
      done: true,
    });
  }, [prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || phase.kind !== "typing") return undefined;

    if (phase.charIndex < PROMPT.length) {
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
  }, [phase, prefersReducedMotion]);

  useEffect(() => {
    if (prefersReducedMotion || phase.kind !== "running" || phase.done) return undefined;

    const step = STEPS[phase.stepIndex];
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
      if (next < STEPS.length) {
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
  }, [phase, prefersReducedMotion]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  });

  const isDone = phase.kind === "running" && phase.done;
  const isTyping = phase.kind === "typing";
  const typedPrompt = phase.kind === "typing" ? PROMPT.slice(0, phase.charIndex) : PROMPT;

  const visibleTranscript = useMemo(() => {
    if (phase.kind === "typing") return [];

    const transcript = completedSteps.map((stepIndex) => ({
      step: STEPS[stepIndex],
      lines: STEPS[stepIndex].lines,
      complete: true,
    }));

    const activeStep = STEPS[phase.stepIndex];
    if (!phase.done && activeStep && !completedSteps.includes(phase.stepIndex)) {
      transcript.push({
        step: activeStep,
        lines: activeStep.lines.slice(0, phase.lineIndex),
        complete: false,
      });
    }

    return transcript;
  }, [completedSteps, phase]);

  return (
    <div
      id="workflow-run"
      className="h-[44rem] overflow-hidden rounded-lg border border-white/[0.08] bg-[#090909] shadow-2xl shadow-black/40 lg:h-[34rem]"
    >
      <div className="grid h-full overflow-y-auto lg:grid-cols-[15rem_minmax(0,1fr)] lg:overflow-hidden">
        <aside className="overflow-y-auto border-b border-white/[0.06] bg-white/[0.018] p-3 lg:border-b-0 lg:border-r">
          <div className="mb-3 flex items-center justify-between gap-2">
            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-white/25">Startup Goal</p>
              <h3 className="mt-1 text-xs font-medium text-white/80">Run calls</h3>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 text-white/35 transition hover:border-white/20 hover:text-white/70"
              aria-label="Replay startup goal demo"
              title="Replay"
            >
              <RotateCcw size={13} />
            </button>
          </div>

          <div className="space-y-1.5">
            {STEPS.map((step, index) => {
              const status = getStepStatus(phase, index, completedSteps);
              const Icon = step.icon;
              return (
                <div
                  key={step.skill}
                  className={`group relative overflow-hidden rounded-lg border px-2.5 py-2 transition-all duration-500 ${
                    status === "active"
                      ? `${step.border} ${step.bg} shadow-lg ${step.shadow}`
                      : status === "complete"
                        ? "border-white/10 bg-white/[0.04]"
                        : "border-white/[0.06] bg-transparent"
                  }`}
                >
                  <div className="relative z-10 flex items-center gap-2">
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${
                        status === "queued"
                          ? "border-white/[0.06] text-white/18"
                          : `${step.border} ${step.color}`
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
                              ? step.color
                              : status === "complete"
                                ? "text-emerald-200/65"
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
                </div>
              );
            })}
          </div>
        </aside>

        <div className="flex min-h-[28rem] flex-col border-b border-white/[0.06] lg:min-h-0 lg:border-b-0">
          <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-red-500/60" />
              <span className="h-2 w-2 rounded-full bg-yellow-500/60" />
              <span className="h-2 w-2 rounded-full bg-green-500/60" />
            </div>
            <span className="font-mono text-[11px] text-white/28">
              agent-workbench/startup-goal
            </span>
            <span className="text-[10px] text-white/20">{isDone ? "done" : "running"}</span>
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
                    Recognized <code className="text-violet-100/75">startup-goal</code>. Loading
                    role map, approval gate, and verification expectations.
                  </p>
                </div>
              </div>
            ) : null}

            {visibleTranscript.map(({ step, lines, complete }) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.skill}
                  className="flex gap-2.5 motion-safe:animate-[agent-message_360ms_ease-out_both]"
                >
                  <span
                    className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border ${step.border} ${step.bg} ${step.color}`}
                  >
                    <Icon size={13} />
                  </span>
                  <div className="min-w-0 flex-1 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 py-2">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className={`text-[11px] font-medium ${step.color}`}>{step.owner}</span>
                      <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px] text-white/32">
                        {step.skill}
                      </code>
                      {complete ? (
                        <span className="inline-flex items-center gap-1 rounded bg-emerald-300/10 px-1.5 py-0.5 text-[10px] text-emerald-200/70">
                          <Check size={10} />
                          returned
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-white/35">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                          thinking
                        </span>
                      )}
                    </div>
                    <div className="space-y-1">
                      {lines.map((line) => (
                        <div key={line} className="flex gap-1.5 text-xs leading-5 text-white/46">
                          <ChevronRight size={12} className="mt-1 shrink-0 text-white/20" />
                          <span>{line}</span>
                        </div>
                      ))}
                    </div>
                    {complete ? (
                      <p className="mt-1.5 border-t border-white/[0.06] pt-1.5 text-xs leading-5 text-white/66">
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
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-emerald-300/20 bg-emerald-400/10 text-emerald-200">
                  <Sparkles size={13} />
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-emerald-300/15 bg-emerald-400/[0.07] px-2.5 py-2">
                  <p className="mb-1 text-[11px] text-emerald-100/45">Combined answer</p>
                  <p className="text-xs leading-5 text-white/72">
                    Startup plan ready: strategy, product scope, architecture guardrails, delivery
                    sequence, implementation slice, and QA gate are merged into one next action.
                  </p>
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
  );
}
