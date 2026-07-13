"use client";

import { ArrowRight, Check, Copy, Github, Search, X, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import { commands, githubUrl, workflows } from "../lib/landing-content";
import { Reveal } from "./reveal";
import { TerminalBlock } from "./terminal-block";
import { WorkflowCard } from "./workflow-card";
import { WorkflowRunDemo } from "./workflow-run-demo";

interface LandingPageProps {
  githubStarsLabel?: string;
}

export function LandingPage({ githubStarsLabel = "Stars" }: LandingPageProps) {
  const [activeCommand, setActiveCommand] = useState(0);
  const [copiedCommandIndex, setCopiedCommandIndex] = useState<number | null>(null);
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

  const active = commands[activeCommand] ?? commands[0];
  const heroInstallCommand = commands[0]?.command ?? "npx omniskill@latest install startup-team";

  function copyCommand(command: (typeof commands)[number], index: number) {
    setActiveCommand(index);
    void navigator.clipboard.writeText(command.command);
    setCopiedCommandIndex(index);
    window.setTimeout(() => {
      setCopiedCommandIndex((current) => (current === index ? null : current));
    }, 1600);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#f6f4ef] text-[var(--ink)]">
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-[var(--accent)] text-white">
            <Zap size={14} />
          </span>
          <span className="text-sm font-semibold text-[var(--ink)]">Omniskills</span>
        </a>
        <div className="flex items-center gap-4 text-sm text-[var(--body)] sm:gap-6">
          <a href="#workflows" className="transition-colors hover:text-[var(--ink)]">
            Workflows
          </a>
          <a href="#install" className="transition-colors hover:text-[var(--ink)]">
            Install
          </a>
          <a
            href={githubUrl}
            aria-label={`Open GitHub repository, ${githubStarsLabel}`}
            className="inline-flex items-center gap-1.5 transition-colors hover:text-[var(--ink)]"
          >
            <Github size={15} />
            <span className="hidden sm:inline">{githubStarsLabel}</span>
          </a>
        </div>
      </nav>

      <section id="top" className="mx-auto max-w-6xl px-5 pb-16 pt-14 sm:pb-20 sm:pt-20">
        <Reveal className="motion-masthead" index={0}>
          <p className="mb-5 max-w-xl text-sm font-medium text-[var(--muted)]">
            Workflow skill trees for Claude, Codex, Cursor, opencode, and GitHub Copilot.
          </p>
        </Reveal>
        <Reveal className="motion-masthead" index={1}>
          <h1 className="max-w-[13ch] text-[clamp(2.75rem,7vw,5.75rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-[var(--ink)]">
            Power your ability. Install the workflow.
          </h1>
        </Reveal>
        <Reveal className="motion-masthead" index={2}>
          <p className="mt-7 max-w-[62ch] text-base leading-7 text-[var(--body)] sm:text-lg sm:leading-8">
            Omniskills is a many-skill bank for AI agents. Install one workflow skill tree, call one
            entry skill with a goal, and give your agent the roles, playbooks, and verification
            habits that 3x your ability.
          </p>
        </Reveal>
        <Reveal className="motion-masthead" index={3}>
          <div className="mt-9 grid max-w-3xl gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
            <TerminalBlock
              compact
              copyText={heroInstallCommand}
              copyLabel="Copy startup-team install command"
              lines={[{ prefix: "$", text: heroInstallCommand }]}
            />
            <a
              href="#workflows"
              className="editorial-control inline-flex items-center justify-center gap-2 rounded-md bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white hover:bg-[var(--accent-pressed)]"
            >
              Browse workflows
              <ArrowRight size={14} />
            </a>
          </div>
        </Reveal>
      </section>

      <section
        id="workflow-example"
        className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-16 sm:py-20"
      >
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
          Workflow in motion
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)]">
          See startup-goal coordinate the work.
        </h2>
        <p className="mb-8 mt-4 max-w-2xl text-sm leading-6 text-[var(--body)]">
          Watch a real startup situation move through{" "}
          <code className="font-medium text-[var(--ink)]">/startup-goal</code>: intake, approval,
          role routing, handoffs, and one combined next action.
        </p>
        <WorkflowRunDemo />
      </section>

      <section
        id="workflows"
        className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-16 sm:py-20"
      >
        <div className="mb-10 grid gap-6 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-end">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Workflow Registry
            </p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-4xl">
              Pick an Omniskills workflow
            </h2>
            <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--body)]">
              Browse installable workflow bundles, then open a detail route for the role map, skill
              tree, and copyable install command.
            </p>
          </div>
          <div className="relative">
            <Search
              size={15}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--muted)]"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workflows, skills, tags..."
              className="w-full rounded-md border border-[var(--rule)] bg-white py-3 pl-9 pr-9 text-sm text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear workflow search"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] transition-colors hover:text-[var(--ink)]"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
        <div className="border-t border-[var(--rule)]">
          {filteredWorkflows.map((workflow, index) => (
            <Reveal key={workflow.slug} className="motion-registry-row" index={Math.min(index, 5)}>
              <WorkflowCard {...workflow} />
            </Reveal>
          ))}
          {filteredWorkflows.length === 0 ? (
            <div className="border-b border-[var(--rule)] px-5 py-14 text-center text-[var(--body)]">
              <Search size={26} className="mx-auto mb-3 text-[var(--faint)]" />
              <p className="text-sm">
                No workflows match <span className="font-medium text-[var(--ink)]">"{query}"</span>
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="editorial-control mt-3 text-sm font-medium text-[var(--accent-pressed)]"
              >
                Clear search
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section
        id="install"
        className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-16 sm:py-20"
      >
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
                      {copiedCommandIndex === index ? (
                        <Check size={12} className="text-emerald-700" />
                      ) : (
                        <Copy size={12} />
                      )}
                      {copiedCommandIndex === index ? "Copied" : "Copy"}
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

      <section className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-16">
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

      <footer className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-8">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--body)]">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-[var(--accent)]">
              <Zap size={10} className="text-white" />
            </span>
            Omniskills
          </div>
          <div className="flex items-center gap-6 text-xs font-medium text-[var(--muted)]">
            <a href={githubUrl} className="transition-colors hover:text-[var(--ink)]">
              GitHub
            </a>
            <a
              href={`${githubUrl}/blob/main/README.md`}
              className="transition-colors hover:text-[var(--ink)]"
            >
              Docs
            </a>
            <a
              href={`${githubUrl}/blob/main/docs/workflow-author-guide.md`}
              className="transition-colors hover:text-[var(--ink)]"
            >
              Author Guide
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
