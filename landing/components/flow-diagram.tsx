import { ArrowDown } from "lucide-react";

const steps = [
  { label: "Goal", detail: "One clear outcome" },
  { label: "Coordinator", detail: "Clarify, approve, route" },
  { label: "Specialist team", detail: "Parallel role work" },
  { label: "Verified result", detail: "Converge and challenge" },
] as const;

export function FlowDiagram() {
  return (
    <div
      role="img"
      aria-label="Goal flows through a coordinator and specialist team into one verified result"
      className="mx-auto flex w-full max-w-sm flex-col items-center rounded-md border border-[var(--rule)] bg-white p-5"
    >
      {steps.map((step, index) => (
        <div key={step.label} className="flex w-full flex-col items-center">
          <div className="w-full rounded-md border border-[var(--rule)] bg-[var(--paper)] px-4 py-3 text-center">
            <p className="text-sm font-semibold text-[var(--ink)]">{step.label}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{step.detail}</p>
          </div>
          {index < steps.length - 1 ? (
            <div className="py-2 text-[var(--accent)]" aria-hidden="true">
              <ArrowDown size={15} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
