"use client";

import { ChevronRight, RotateCcw, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SkillStep {
  skill: string;
  label: string;
  color: string;
  bg: string;
  lines: string[];
}

const STEPS: SkillStep[] = [
  {
    skill: "startup-goal",
    label: "Route Goal",
    color: "text-violet-400",
    bg: "bg-violet-500/10",
    lines: [
      "Reading goal: launch this product from idea to shipped v1",
      "Selecting the role skills needed for the next decision",
      "Dispatching CEO, CTO, PM, EM, founding engineer, and QA lead",
      "✓ Startup Goal route assembled",
    ],
  },
  {
    skill: "ceo",
    label: "Strategy",
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    lines: [
      "Clarifying customer, wedge, and first painful workflow",
      "Choosing launch learning over broad platform scope",
      "Naming the hard tradeoff: speed before breadth",
      "✓ CEO strategy frame returned",
    ],
  },
  {
    skill: "product-manager",
    label: "Product Scope",
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    lines: [
      "Translating strategy into user problem and v1 promise",
      "Writing acceptance criteria for the first useful demo",
      "Slicing launch work into docs, onboarding, and feedback loop",
      "✓ PM scope and issue slices returned",
    ],
  },
  {
    skill: "cto",
    label: "Architecture",
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    lines: [
      "Checking the workflow manifest and install path",
      "Flagging integration risk around external skill dependencies",
      "Keeping the entry skill thin and role coordination explicit",
      "✓ CTO architecture guardrails returned",
    ],
  },
  {
    skill: "founding-engineer",
    label: "Implementation",
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    lines: [
      "Finding the smallest implementation slice",
      "Updating the manifest, README, and landing source contract",
      "Running focused tests before the repo gate",
      "✓ Verified implementation path returned",
    ],
  },
  {
    skill: "qa-lead",
    label: "QA Review",
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    lines: [
      "Checking acceptance against the original startup goal",
      "Scanning for stale startup-team and OpenSpec-facing examples",
      "Separating verified facts from residual launch risk",
      "✓ Combined startup answer ready",
    ],
  },
];

const PROMPT = "> $startup-goal help me launch this product from idea to shipped v1";
const LINE_DELAY = 170;
const BETWEEN_STEPS = 500;

type Phase =
  | { kind: "typing"; charIndex: number }
  | { kind: "running"; stepIndex: number; lineIndex: number; done: boolean };

export function WorkflowRunDemo() {
  const [phase, setPhase] = useState<Phase>({ kind: "typing", charIndex: 0 });
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const reset = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setCompletedSteps([]);
    setPhase({ kind: "typing", charIndex: 0 });
  };

  useEffect(() => {
    if (phase.kind !== "typing") return undefined;

    if (phase.charIndex < PROMPT.length) {
      timerRef.current = setTimeout(
        () => setPhase({ kind: "typing", charIndex: phase.charIndex + 1 }),
        24,
      );
    } else {
      timerRef.current = setTimeout(
        () => setPhase({ kind: "running", stepIndex: 0, lineIndex: 0, done: false }),
        500,
      );
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [phase]);

  useEffect(() => {
    if (phase.kind !== "running" || phase.done) return undefined;

    const step = STEPS[phase.stepIndex];
    if (!step) return undefined;

    if (phase.lineIndex < step.lines.length) {
      timerRef.current = setTimeout(
        () => setPhase({ ...phase, lineIndex: phase.lineIndex + 1 }),
        LINE_DELAY + Math.random() * 60,
      );
    } else {
      setCompletedSteps((current) => [...current, phase.stepIndex]);
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
  }, [phase]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  });

  const isDone = phase.kind === "running" && phase.done;
  const isRunning = phase.kind === "running" && !phase.done;
  const typedPrompt = phase.kind === "typing" ? PROMPT.slice(0, phase.charIndex) : PROMPT;

  return (
    <section id="workflow-run" className="relative z-10 mx-auto max-w-4xl px-5 py-12">
      <div className="mb-8 text-center">
        <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/32">Try it live</p>
        <h2 className="text-3xl font-medium text-white/90">Watch the workflow run</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/42">
          Simulate calling <code className="text-white/60">$startup-goal</code> and see each role
          skill return its part of the combined answer.
        </p>
      </div>

      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#080808]">
        <div className="flex items-center justify-between border-b border-white/[0.06] bg-white/[0.02] px-5 py-3">
          <div className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-500/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-500/60" />
          </div>
          <span className="font-mono text-xs text-white/25">$startup-goal</span>
          <button
            type="button"
            onClick={reset}
            className="flex items-center gap-1.5 text-xs text-white/25 transition-colors hover:text-white/50"
          >
            <RotateCcw size={11} />
            Replay
          </button>
        </div>

        <div className="flex items-center gap-0 overflow-x-auto border-b border-white/[0.05] px-5 py-3">
          {STEPS.map((step, index) => {
            const isActive = phase.kind === "running" && phase.stepIndex === index;
            const isDoneStep = completedSteps.includes(index);
            return (
              <div key={step.skill} className="flex shrink-0 items-center gap-0">
                <div
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 transition-all duration-300 ${
                    isDoneStep || isActive ? `${step.bg} ${step.color}` : "text-white/20"
                  }`}
                >
                  {isDoneStep ? (
                    <span className="text-xs">✓</span>
                  ) : isActive ? (
                    <span
                      className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                      style={{ background: "currentColor" }}
                    />
                  ) : (
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-white/15" />
                  )}
                  <code className="font-mono text-xs">{step.skill}</code>
                </div>
                {index < STEPS.length - 1 ? (
                  <ChevronRight size={12} className="mx-0.5 text-white/15" />
                ) : null}
              </div>
            );
          })}
        </div>

        <div
          ref={scrollRef}
          className="h-72 space-y-0.5 overflow-y-auto p-5 font-mono text-xs"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="mb-3 flex gap-2">
            <span className="shrink-0 text-violet-400">agent</span>
            <span className="break-words text-white/70">
              {typedPrompt.replace(/^> /, "")}
              {phase.kind === "typing" ? (
                <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-white/60 align-middle" />
              ) : null}
            </span>
          </div>

          {completedSteps.map((stepIndex) => {
            const step = STEPS[stepIndex];
            if (!step) return null;

            return (
              <div key={step.skill} className="mb-3">
                <div className={`mb-1.5 flex items-center gap-2 ${step.color}`}>
                  <Zap size={10} />
                  <span className="text-[10px] uppercase tracking-wider">{step.label}</span>
                </div>
                {step.lines.map((line) => (
                  <div key={line} className="pl-4 leading-relaxed text-white/40">
                    {line}
                  </div>
                ))}
              </div>
            );
          })}

          {isRunning ? (
            <div className="mb-3">
              <div className={`mb-1.5 flex items-center gap-2 ${STEPS[phase.stepIndex].color}`}>
                <span
                  className="inline-block h-1.5 w-1.5 animate-pulse rounded-full"
                  style={{ background: "currentColor" }}
                />
                <span className="text-[10px] uppercase tracking-wider">
                  {STEPS[phase.stepIndex].label}
                </span>
              </div>
              {STEPS[phase.stepIndex].lines.slice(0, phase.lineIndex).map((line) => (
                <div key={line} className="pl-4 leading-relaxed text-white/40">
                  {line}
                </div>
              ))}
              <div className="pl-4">
                <span className="inline-block h-3 w-1.5 animate-pulse bg-white/30 align-middle" />
              </div>
            </div>
          ) : null}

          {isDone ? (
            <div className="mt-3 border-t border-white/[0.06] pt-3">
              <div className="flex items-center gap-2 text-emerald-400">
                <span>✓</span>
                <span>Workflow complete — all 6 role skills combined</span>
              </div>
              <div className="mt-0.5 pl-4 text-white/25">
                Startup plan ready for the next action.
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
