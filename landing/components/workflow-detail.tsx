import { ArrowRight, ExternalLink, GitBranch, Zap } from "lucide-react";
import type { WorkflowCardContent } from "../lib/landing-content";
import { WorkflowAvatar } from "./workflow-avatar";

interface WorkflowDetailProps {
  workflow: WorkflowCardContent;
}

export function WorkflowDetail({ workflow }: WorkflowDetailProps) {
  return (
    <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5 lg:sticky lg:top-6">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div className="flex min-w-0 gap-3">
          <WorkflowAvatar seed={workflow.avatarSeed} label={workflow.name} size={44} />
          <div className="min-w-0">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">
              Selected workflow
            </p>
            <h3 className="text-xl font-medium text-white/90">{workflow.name}</h3>
          </div>
        </div>
        <span
          className={`rounded-full border border-current/20 px-2 py-0.5 text-xs ${workflow.accent}`}
        >
          {workflow.tag}
        </span>
      </div>

      <div className="rounded-lg border border-white/10 bg-black/35 p-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/35">
          <Zap size={12} className="text-amber-300" />
          entry skill
        </div>
        <code className={`mt-2 block break-all font-mono text-sm ${workflow.accent}`}>
          ${workflow.entrySkill}
        </code>
      </div>

      <div className="mt-5 space-y-3">
        {workflow.diagramSteps.map((step, index) => (
          <div key={`${step.label}-${step.skill}`} className="relative flex gap-3">
            <div className="flex flex-col items-center">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-xs text-white/55">
                {index + 1}
              </span>
              {index < workflow.diagramSteps.length - 1 ? (
                <span className="my-1 h-full min-h-5 w-px bg-white/10" />
              ) : null}
            </div>
            <div className="pb-2">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-white/82">{step.label}</p>
                <ArrowRight size={12} className="text-white/25" />
                <code className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-xs text-white/62">
                  {step.skill}
                </code>
              </div>
              <p className="mt-1 text-xs leading-5 text-white/42">{step.description}</p>
            </div>
          </div>
        ))}
      </div>

      <a
        href={workflow.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 px-4 py-3 text-sm text-white/62 transition hover:border-white/20 hover:text-white/85"
      >
        <GitBranch size={14} />
        View source on GitHub
        <ExternalLink size={13} />
      </a>
    </aside>
  );
}
