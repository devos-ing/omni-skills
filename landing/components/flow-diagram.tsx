import { ArrowDown } from "lucide-react";

const steps = [
  {
    label: "User invokes",
    value: "$startup-goal",
    classes: "border-violet-400/25 bg-violet-400/10 text-violet-200",
  },
  {
    label: "Entry skill coordinates",
    value: "startup-goal entry skill",
    classes: "border-sky-400/25 bg-sky-400/10 text-sky-200",
  },
  {
    label: "Role skills combine",
    values: ["CEO", "PM", "CTO", "EM", "engineer", "QA"],
    classes: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
  },
];

export function FlowDiagram() {
  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center">
      {steps.map((step, index) => (
        <div key={step.label} className="flex w-full flex-col items-center">
          <div className={`w-full rounded-lg border px-4 py-3 ${step.classes}`}>
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">{step.label}</p>
            {"value" in step ? (
              <code className="font-mono text-sm">{step.value}</code>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {step.values.map((value) => (
                  <code key={value} className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs">
                    {value}
                  </code>
                ))}
              </div>
            )}
          </div>
          {index < steps.length - 1 ? (
            <div className="py-2 text-white/25">
              <ArrowDown size={16} />
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
