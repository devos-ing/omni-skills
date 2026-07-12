import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { WorkflowCardContent } from "../lib/landing-content";
import { WorkflowAvatar } from "./workflow-avatar";

type WorkflowCardProps = WorkflowCardContent;

export function WorkflowCard({
  slug,
  name,
  description,
  entrySkill,
  avatarSeed,
  tag,
  accent,
  skills,
}: WorkflowCardProps) {
  return (
    <Link
      href={`/workflows/${slug}`}
      className="editorial-control fine-pointer-arrow group grid gap-4 border-b border-[var(--rule)] py-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <div className="flex min-w-0 gap-4">
        <span className="motion-avatar shrink-0 transition-transform duration-150">
          <WorkflowAvatar seed={avatarSeed} label={name} />
        </span>
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="text-base font-semibold text-[var(--ink)]">{name}</h3>
            <span
              className={`inline-flex shrink-0 rounded border border-current/30 px-2 py-0.5 text-xs font-medium ${accent}`}
            >
              {tag}
            </span>
          </div>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--body)]">{description}</p>
          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs text-[var(--muted)]">
            <span className="font-mono">${entrySkill}</span>
            <span>{skills.length} skills</span>
          </div>
        </div>
      </div>

      <span className="inline-flex items-center gap-2 text-sm font-medium text-[var(--body)] md:justify-self-end">
        View workflow
        <ArrowRight
          size={14}
          className="fine-pointer-arrow-icon transition-transform duration-150"
        />
      </span>
    </Link>
  );
}
