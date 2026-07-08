import { ArrowRight, Boxes, Zap } from "lucide-react";
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
      className="group grid gap-4 rounded-lg border border-white/10 bg-white/[0.025] p-4 transition hover:border-white/20 hover:bg-white/[0.055] focus:outline-none focus-visible:ring-2 focus-visible:ring-violet-300/45 md:grid-cols-[minmax(0,1fr)_auto] md:items-center"
    >
      <div className="flex min-w-0 gap-3">
        <WorkflowAvatar seed={avatarSeed} label={name} />
        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-white/88 transition group-hover:text-white">
              {name}
            </h3>
            <span
              className={`inline-flex shrink-0 rounded border border-current/20 px-1.5 py-0.5 text-[10px] ${accent}`}
            >
              {tag}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-5 text-white/42">{description}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 font-mono text-xs text-white/48">
              <Zap size={11} className="text-amber-300" />${entrySkill}
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-white/35">
              <Boxes size={11} className="text-white/25" />
              {skills.length} skills
            </span>
            <span className="inline-flex items-center gap-1.5 text-xs text-white/35">
              View workflow
              <ArrowRight size={11} className="transition group-hover:translate-x-0.5" />
            </span>
          </div>
        </div>
      </div>

      <span className="inline-flex items-center gap-1.5 text-xs text-white/35 transition group-hover:text-white/62 md:justify-self-end">
        Open detail
        <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
      </span>
    </Link>
  );
}
