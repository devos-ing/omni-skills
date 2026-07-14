import { ArrowUpRight } from "lucide-react";
import type { SkillHubEntry } from "../lib/skill-hub";

export function SkillRow({ entry }: { entry: SkillHubEntry }) {
  const relationships = entry.usedBy.map(({ name }) => name).join(" · ");

  return (
    <article className="grid gap-4 border-b border-[var(--rule)] py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <h3 className="break-words font-mono text-sm font-semibold text-[var(--ink)]">
          {entry.name}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--body)]">{entry.description}</p>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          {entry.provider} · Included in {relationships}
        </p>
      </div>
      <a
        href={entry.sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${entry.name} skill source (opens in a new tab)`}
        className="editorial-control fine-pointer-arrow inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--body)] hover:text-[var(--ink)] md:justify-self-end"
      >
        View skill source
        <ArrowUpRight
          size={14}
          className="fine-pointer-arrow-icon transition-transform duration-150"
        />
      </a>
    </article>
  );
}
