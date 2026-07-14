import { Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import { skillHubSectionContent, type WorkflowCardContent } from "../lib/landing-content";
import type { SkillHubEntry } from "../lib/skill-hub";
import { SkillRow } from "./skill-row";
import { WorkflowCard } from "./workflow-card";

export type HubTab = "workflows" | "skills";

interface SkillHubProps {
  activeTab: HubTab;
  query: string;
  workflows: WorkflowCardContent[];
  skills: SkillHubEntry[];
  onTabChange: (tab: HubTab) => void;
  onQueryChange: (query: string) => void;
}

const tabs: Array<{ id: HubTab; label: string }> = [
  { id: "workflows", label: skillHubSectionContent.tabs.workflows.label },
  { id: "skills", label: skillHubSectionContent.tabs.skills.label },
];

interface EmptyStateProps {
  nounPlural: string;
  query: string;
  onClear: () => void;
}

function EmptyState({ nounPlural, query, onClear }: EmptyStateProps) {
  return (
    <div className="border-b border-[var(--rule)] px-5 py-14 text-center text-[var(--body)]">
      <Search size={26} className="mx-auto mb-3 text-[var(--faint)]" />
      <p className="text-sm">
        {skillHubSectionContent.noResultsPrefix} {nounPlural} {skillHubSectionContent.matchLabel}{" "}
        <span className="font-medium text-[var(--ink)]">"{query}"</span>.
      </p>
      <button
        type="button"
        onClick={onClear}
        className="mt-3 min-h-11 px-2 text-sm font-medium text-[var(--accent-pressed)] transition-colors duration-150 hover:text-[var(--ink)] active:bg-[#f0ede6]"
      >
        {skillHubSectionContent.clearAction}
      </button>
    </div>
  );
}

export function SkillHub({
  activeTab,
  query,
  workflows,
  skills,
  onTabChange,
  onQueryChange,
}: SkillHubProps) {
  const activeCatalog = skillHubSectionContent.tabs[activeTab];
  const count = activeTab === "workflows" ? workflows.length : skills.length;

  function handleTabKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentTab: HubTab) {
    const currentIndex = tabs.findIndex(({ id }) => id === currentTab);
    let nextIndex: number | null = null;
    if (event.key === "ArrowRight") nextIndex = (currentIndex + 1) % tabs.length;
    if (event.key === "ArrowLeft") nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") nextIndex = 0;
    if (event.key === "End") nextIndex = tabs.length - 1;
    if (nextIndex === null) return;
    event.preventDefault();
    const nextTab = tabs[nextIndex]?.id ?? "workflows";
    onTabChange(nextTab);
    window.requestAnimationFrame(() => document.getElementById(`hub-tab-${nextTab}`)?.focus());
  }

  return (
    <section
      id="skill-hub"
      aria-labelledby="skill-hub-heading"
      className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-16 sm:py-20"
    >
      <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
            {skillHubSectionContent.eyebrow}
          </p>
          <h2
            id="skill-hub-heading"
            className="mt-3 text-3xl font-semibold text-[var(--ink)] sm:text-4xl"
          >
            {skillHubSectionContent.heading}
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--body)]">
            {skillHubSectionContent.lead}
          </p>
        </div>
        <div>
          <div
            role="tablist"
            aria-label={skillHubSectionContent.catalogLabel}
            className="grid grid-cols-2 border-b border-[var(--rule)]"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                id={`hub-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                aria-controls={`hub-panel-${tab.id}`}
                tabIndex={activeTab === tab.id ? 0 : -1}
                onClick={() => onTabChange(tab.id)}
                onKeyDown={(event) => handleTabKeyDown(event, tab.id)}
                className={`min-h-11 border-b-2 px-4 text-sm transition-colors duration-150 active:bg-[#f0ede6] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  activeTab === tab.id
                    ? "border-[var(--accent)] font-semibold text-[var(--ink)]"
                    : "border-transparent font-medium text-[var(--muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label htmlFor="skill-hub-search" className="sr-only">
            {activeCatalog.searchLabel}
          </label>
          <div className="relative mt-4">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              id="skill-hub-search"
              type="search"
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder={activeCatalog.placeholder}
              className="min-h-11 w-full rounded-md border border-[var(--rule)] bg-white py-3 pl-9 pr-9 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label={activeCatalog.clearLabel}
                className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)] active:bg-[#f0ede6]"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {count} {activeCatalog.noun} {count === 1 ? "result" : "results"}
      </p>
      <div
        id="hub-panel-workflows"
        role="tabpanel"
        aria-labelledby="hub-tab-workflows"
        hidden={activeTab !== "workflows"}
        className="mt-10 border-t border-[var(--rule)]"
      >
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.slug} {...workflow} />
        ))}
        {activeTab === "workflows" && count === 0 ? (
          <EmptyState
            nounPlural={skillHubSectionContent.tabs.workflows.nounPlural}
            query={query}
            onClear={() => onQueryChange("")}
          />
        ) : null}
      </div>
      <div
        id="hub-panel-skills"
        role="tabpanel"
        aria-labelledby="hub-tab-skills"
        hidden={activeTab !== "skills"}
        className="mt-10 border-t border-[var(--rule)]"
      >
        {skills.map((skill) => (
          <SkillRow key={skill.id} entry={skill} />
        ))}
        {activeTab === "skills" && count === 0 ? (
          <EmptyState
            nounPlural={skillHubSectionContent.tabs.skills.nounPlural}
            query={query}
            onClear={() => onQueryChange("")}
          />
        ) : null}
      </div>
    </section>
  );
}
