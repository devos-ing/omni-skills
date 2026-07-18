"use client";

import { ArrowRight, Check, Copy, Github } from "lucide-react";
import { useMemo, useState } from "react";
import { copyText } from "../lib/clipboard";
import {
  agents,
  audienceStories,
  capabilities,
  commands,
  faqItems,
  githubUrl,
  startupLandingContent,
  startupSteps,
  startupTeam,
  teams,
  whyFeatures,
  workflows,
} from "../lib/landing-content";
import { skillHubEntries } from "../lib/skill-hub";
import { AudienceShowcase } from "./audience-showcase";
import { CapabilityGrid } from "./capability-grid";
import { FeaturedTeamSection } from "./featured-team-section";
import { FinalInstallCta } from "./final-install-cta";
import { HowStartupTeamWorks } from "./how-startup-team-works";
import { LandingFaq } from "./landing-faq";
import { type HubTab, SkillHub } from "./skill-hub";
import { OmniskillsMark, StartupTeamHero } from "./startup-team-hero";
import { SupportedAgentStrip } from "./supported-agent-strip";
import { TerminalBlock } from "./terminal-block";
import { WhyOmniskills } from "./why-omniskills";

interface LandingPageProps {
  githubStarsLabel?: string;
}

export function LandingPage({ githubStarsLabel = "Stars" }: LandingPageProps) {
  const [activeCommand, setActiveCommand] = useState(0);
  const [activeHubTab, setActiveHubTab] = useState<HubTab>("workflows");
  const [copyFeedback, setCopyFeedback] = useState<{
    index: number;
    status: "copied" | "failed";
  } | null>(null);
  const [query, setQuery] = useState("");

  const filteredWorkflows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return workflows;

    return workflows.filter((workflow) => {
      return (
        workflow.name.toLowerCase().includes(needle) ||
        workflow.description.toLowerCase().includes(needle) ||
        workflow.entrySkill.toLowerCase().includes(needle) ||
        workflow.tag.toLowerCase().includes(needle) ||
        workflow.skills.some(
          (skill) =>
            skill.name.toLowerCase().includes(needle) ||
            skill.description.toLowerCase().includes(needle),
        )
      );
    });
  }, [query]);

  const filteredSkills = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return skillHubEntries;

    return skillHubEntries.filter((skill) => {
      return (
        skill.name.toLowerCase().includes(needle) ||
        skill.description.toLowerCase().includes(needle) ||
        skill.provider.toLowerCase().includes(needle) ||
        skill.usedBy.some(({ name }) => name.toLowerCase().includes(needle))
      );
    });
  }, [query]);

  const active = commands[activeCommand] ?? commands[0];

  async function copyCommand(command: (typeof commands)[number], index: number) {
    setActiveCommand(index);
    const copied = await copyText(command.command, navigator.clipboard);
    setCopyFeedback({ index, status: copied ? "copied" : "failed" });
    if (copied) {
      window.setTimeout(() => {
        setCopyFeedback((current) => (current?.index === index ? null : current));
      }, 1600);
    }
  }

  return (
    <main className="site-shell min-h-screen overflow-hidden text-[var(--ink)]">
      <div className="site-rail site-rail-left" aria-hidden="true" />
      <div className="site-rail site-rail-right" aria-hidden="true" />
      <header className="site-header">
        <nav className="site-nav" aria-label="Main navigation">
          <a href="#top" className="site-brand">
            <OmniskillsMark compact />
            <span>Omniskills</span>
          </a>
          <div className="site-nav-links">
            <a href="#showcase">Showcase</a>
            <a href="#capabilities">Capabilities</a>
            <a href="#why">Why Omniskills</a>
            <a href="#workflows">Teams &amp; Skills</a>
            <a href="#faq">FAQ</a>
          </div>
          <div className="site-nav-actions">
            <a
              href={githubUrl}
              aria-label={`Open GitHub repository, ${githubStarsLabel}`}
              className="nav-github"
            >
              <Github size={15} />
              <span>{githubStarsLabel}</span>
            </a>
            <a href="#install" className="nav-install">
              Install team
            </a>
          </div>
        </nav>
      </header>

      <StartupTeamHero
        content={startupLandingContent}
        githubStarsLabel={githubStarsLabel}
        githubUrl={githubUrl}
      />
      <AudienceShowcase stories={audienceStories} />
      <SupportedAgentStrip
        agents={agents}
        label={startupLandingContent.supportedAgentsLabel}
        compatibility={startupLandingContent.compatibility}
      />
      <CapabilityGrid items={capabilities} />
      <WhyOmniskills features={whyFeatures} />
      <FeaturedTeamSection teams={teams} />
      <SkillHub
        activeTab={activeHubTab}
        query={query}
        workflows={filteredWorkflows}
        skills={filteredSkills}
        onTabChange={setActiveHubTab}
        onQueryChange={setQuery}
      />
      <HowStartupTeamWorks steps={startupSteps} />

      <section id="install" className="landing-section utility-section">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Common commands
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
              Get up and running fast
            </h2>
            <p className="mb-8 mt-4 text-sm leading-6 text-[var(--body)]">
              Install by alias, public git URL, or local path. The CLI validates the workflow
              manifest, bootstraps missing external skills from workflow metadata, and records
              installed Omniskills workflows under{" "}
              <code className="font-medium text-[var(--ink)]">~/.omniskills/workflows/</code> by
              default. Loop-enabled workflows use{" "}
              <code className="font-medium text-[var(--ink)]">omniskill loop</code> for resumable,
              action-only state.
            </p>
            <div className="border-t border-[var(--rule)]">
              {commands.map((command, index) => (
                <button
                  key={command.label}
                  type="button"
                  onClick={() => copyCommand(command, index)}
                  aria-label={`Copy command: ${command.command}`}
                  className={`editorial-control group w-full cursor-copy border-b border-[var(--rule)] px-3 py-4 text-left ${activeCommand === index ? "bg-white" : "bg-transparent"}`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-[var(--ink)]">
                        {command.label}
                      </span>
                      <code className="mt-1 block break-words font-mono text-xs leading-5 text-[var(--muted)]">
                        {command.command}
                      </code>
                    </span>
                    <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-[var(--body)]">
                      {copyFeedback?.index === index && copyFeedback.status === "copied" ? (
                        <Check size={12} className="text-emerald-700" />
                      ) : (
                        <Copy size={12} />
                      )}
                      {copyFeedback?.index === index
                        ? copyFeedback.status === "copied"
                          ? "Copied"
                          : "Select and copy command"
                        : "Copy"}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-5">
            <TerminalBlock
              copyText={active.command}
              lines={[{ prefix: "$", text: active.command }]}
            />
            <div className="border-t border-[var(--rule)] pt-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Then invoke in your agent
              </p>
              <TerminalBlock
                lines={[
                  {
                    prefix: ">",
                    text: "/startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
                  },
                  { text: "", dim: true },
                  {
                    text: "[ok] Intake     clarified customer, deadline, and non-goals",
                    dim: true,
                  },
                  { text: "[ok] CEO        chose a narrow first wedge", dim: true },
                  {
                    text: "[ok] PM         scoped receipt capture to month-end summary",
                    dim: true,
                  },
                  { text: "[ok] CTO        kept finance automation behind seams", dim: true },
                  {
                    text: "[ok] EM         sequenced prototype, pilots, and release gate",
                    dim: true,
                  },
                  { text: "[ok] engineer   selected the receipt-to-summary slice", dim: true },
                  {
                    text: "[ok] QA         checked privacy, totals, and recovery paths",
                    dim: true,
                  },
                ]}
              />
            </div>
          </div>
        </div>
      </section>

      <section className="landing-section utility-section author-section">
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(22rem,0.8fr)] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Author your own workflow
            </p>
            <h2 className="mt-3 max-w-2xl text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
              Package your workflow as an Omniskills workflow
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--body)]">
              Scaffold a bundle, define the entry skill, list sub-skills in workflow.json, validate,
              and share.
            </p>
          </div>
          <div className="space-y-3">
            <TerminalBlock
              copyText="npx omniskill@latest init my-workflow"
              lines={[{ prefix: "$", text: "npx omniskill@latest init my-workflow" }]}
            />
            <a
              href={`${githubUrl}/blob/main/docs/workflow-author-guide.md`}
              className="editorial-control inline-flex items-center gap-2 text-sm font-medium text-[var(--body)] hover:text-[var(--ink)]"
            >
              Author guide <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      <LandingFaq items={faqItems} />
      <div className="closing-band">
        <FinalInstallCta
          command={startupLandingContent.installCommand}
          sourceUrl={startupTeam.sourceUrl}
        />
        <footer className="site-footer">
          <div className="site-footer-brand">
            <OmniskillsMark compact />
            <span>Omniskills</span>
          </div>
          <p>Composable teams and workflows for agent environments.</p>
          <div className="site-footer-links">
            <a href={githubUrl}>GitHub</a>
            <a href={`${githubUrl}/blob/main/README.md`}>Docs</a>
            <a href={`${githubUrl}/blob/main/docs/workflow-author-guide.md`}>Author Guide</a>
          </div>
        </footer>
      </div>
    </main>
  );
}
