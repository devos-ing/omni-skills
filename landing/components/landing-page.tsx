"use client";

import { ArrowRight, Check, Copy, Github, Search, Workflow, X, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type AgentBadgeContent,
  agents,
  commands,
  githubUrl,
  workflows,
} from "../lib/landing-content";
import { TerminalBlock } from "./terminal-block";
import { WorkflowCard } from "./workflow-card";
import { WorkflowRunDemo } from "./workflow-run-demo";

const agentLogoStyles: Record<AgentBadgeContent["id"], string> = {
  claude: "border-orange-200/15 bg-orange-300/10 text-orange-200",
  codex: "border-emerald-200/15 bg-emerald-300/10 text-emerald-200",
  cursor: "border-white/15 bg-white/[0.06] text-white/80",
  opencode: "border-sky-200/15 bg-sky-300/10 text-sky-200",
  "github-copilot": "border-violet-200/15 bg-violet-300/10 text-violet-200",
};

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
  const heroInstallCommand =
    commands[0]?.command ?? "npx getsuperpower@latest install startup-goal";

  function copyCommand(command: (typeof commands)[number], index: number) {
    setActiveCommand(index);
    void navigator.clipboard.writeText(command.command);
    setCopiedCommandIndex(index);
    window.setTimeout(() => {
      setCopiedCommandIndex((current) => (current === index ? null : current));
    }, 1600);
  }

  return (
    <main className="min-h-screen overflow-hidden bg-[#080808] text-white">
      <nav className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <a href="#top" className="flex items-center gap-2.5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-500">
            <Zap size={14} />
          </span>
          <span className="text-sm font-medium text-white/90">GetSuperpower</span>
        </a>
        <div className="flex items-center gap-5 text-sm text-white/50">
          <a href="#workflows" className="transition hover:text-white/80">
            Workflows
          </a>
          <a href="#install" className="transition hover:text-white/80">
            Install
          </a>
          <a
            href={githubUrl}
            aria-label={`Open GitHub repository, ${githubStarsLabel}`}
            className="inline-flex items-center gap-1.5 transition hover:text-white/80"
          >
            <Github size={15} />
            <span className="hidden sm:inline">{githubStarsLabel}</span>
          </a>
        </div>
      </nav>

      <section id="top" className="relative z-10 mx-auto max-w-4xl px-5 pb-20 pt-20 text-center">
        <div className="mb-8 inline-flex max-w-full items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-white/55">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-300" />
          <span className="truncate">
            Works with Claude, Codex, Cursor, opencode, and GitHub Copilot
          </span>
        </div>
        <h1 className="text-5xl font-semibold leading-[1.05] text-white sm:text-6xl lg:text-7xl">
          Power your ability.
          <br />
          Install the workflow.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/48">
          GetSuperpower is a many-skill bank for AI agents. Install one workflow skill tree, call
          one entry skill with a goal, and give your agent the roles, playbooks, and verification
          habits that 3x your ability.
        </p>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <div className="min-w-0 sm:min-w-[24rem]">
            <TerminalBlock
              compact
              copyText={heroInstallCommand}
              copyLabel="Copy startup-goal install command"
              lines={[{ prefix: "$", text: heroInstallCommand }]}
            />
          </div>
          <a
            href="#workflows"
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-500 px-5 py-3 text-sm font-medium text-white transition hover:bg-violet-400"
          >
            Browse workflows
            <ArrowRight size={14} />
          </a>
        </div>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
          {agents.map((agent) => (
            <span
              key={agent.id}
              className="inline-flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.03] py-1 pl-1 pr-2.5 text-xs text-white/52"
            >
              {agent.logoSrc ? (
                <span
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${agentLogoStyles[agent.id]}`}
                >
                  <span
                    aria-hidden="true"
                    className="h-3.5 w-3.5 bg-current"
                    style={{
                      WebkitMask: `url(${agent.logoSrc}) center / contain no-repeat`,
                      mask: `url(${agent.logoSrc}) center / contain no-repeat`,
                    }}
                  />
                </span>
              ) : null}
              <span>{agent.name}</span>
            </span>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="mb-10 grid gap-4 lg:grid-cols-[minmax(0,1fr)_24rem] lg:items-end">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/32">Agent run demo</p>
            <h2 className="text-3xl font-medium text-white/90">See where startup-goal fits.</h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-white/42">
              Pick a real startup situation, then simulate calling{" "}
              <code className="text-white/60">/startup-goal</code> in an agent workbench. The entry
              skill records the intake, approval gate, role routing, handoffs, and combined next
              action.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2 text-xs text-white/38">
            <Zap size={14} className="shrink-0 text-violet-200/70" />
            <span>Landing simulation only. No browser-side agent execution or fake telemetry.</span>
          </div>
        </div>
        <WorkflowRunDemo />
      </section>

      <section id="workflows" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="mb-8">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/32">
            Workflow Registry
          </p>
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_28rem] lg:items-end">
            <div>
              <h2 className="text-3xl font-medium text-white/90">Pick a GetSuperpower</h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-white/42">
                Browse installable workflow bundles, then open a detail route for the role map,
                skill tree, and copyable install command.
              </p>
            </div>
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/30"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search workflows, skills, tags..."
                className="w-full rounded-lg border border-white/10 bg-white/[0.04] py-2.5 pl-9 pr-9 text-sm text-white/80 outline-none transition placeholder:text-white/25 focus:border-violet-400/50"
              />
              {query ? (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/35 transition hover:text-white/70"
                >
                  <X size={14} />
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="overflow-hidden rounded-lg border border-white/10">
          <div className="hidden grid-cols-[minmax(0,1fr)_auto] gap-4 border-b border-white/10 bg-white/[0.02] px-4 py-2.5 md:grid">
            <span className="text-xs uppercase tracking-[0.18em] text-white/25">Workflow</span>
            <span className="text-right text-xs uppercase tracking-[0.18em] text-white/25">
              Detail
            </span>
          </div>

          <div className="divide-y divide-white/10">
            {filteredWorkflows.map((workflow) => (
              <WorkflowCard key={workflow.slug} {...workflow} />
            ))}
          </div>

          {filteredWorkflows.length === 0 ? (
            <div className="px-5 py-14 text-center text-white/35">
              <Search size={26} className="mx-auto mb-3 opacity-45" />
              <p className="text-sm">
                No workflows match <span className="text-white/55">"{query}"</span>
              </p>
              <button
                type="button"
                onClick={() => setQuery("")}
                className="mt-3 text-xs text-violet-300 transition hover:text-violet-200"
              >
                Clear search
              </button>
            </div>
          ) : null}
        </div>
      </section>

      <section id="install" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="grid items-start gap-12 lg:grid-cols-2">
          <div>
            <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/32">
              Common commands
            </p>
            <h2 className="mb-4 text-3xl font-medium text-white/90">Get up and running fast</h2>
            <p className="mb-8 text-sm leading-6 text-white/45">
              Install by alias, public git URL, or local path. The CLI validates the workflow
              manifest, bootstraps missing external skills from workflow metadata, and records
              installed GetSuperpowers under{" "}
              <code className="text-white/65">~/.getsuperpower/workflows/</code> by default.
              Loop-enabled workflows use <code className="text-white/65">getsuperpower loop</code>{" "}
              for resumable, action-only state.
            </p>
            <div className="space-y-2">
              {commands.map((command, index) => (
                <button
                  key={command.label}
                  type="button"
                  onClick={() => copyCommand(command, index)}
                  aria-label={`Copy command: ${command.command}`}
                  className={`group w-full cursor-copy rounded-lg border px-4 py-3 text-left text-sm transition ${
                    activeCommand === index
                      ? "border-violet-400/45 bg-violet-400/10 text-white/85"
                      : "border-white/10 bg-white/[0.025] text-white/45 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block">{command.label}</span>
                      <code
                        className={`mt-1 block break-words font-mono text-xs ${
                          activeCommand === index
                            ? "text-white/55"
                            : "text-white/30 group-hover:text-white/50"
                        }`}
                      >
                        {command.command}
                      </code>
                    </span>
                    <span
                      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${
                        activeCommand === index
                          ? "border-violet-300/25 text-violet-100/70"
                          : "border-white/10 text-white/35 group-hover:border-white/20 group-hover:text-white/65"
                      }`}
                    >
                      {copiedCommandIndex === index ? (
                        <Check size={12} className="text-emerald-300" />
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
          <div className="space-y-4">
            <TerminalBlock
              copyText={active.command}
              lines={[{ prefix: "$", text: active.command }]}
            />
            <div className="rounded-lg border border-white/10 bg-white/[0.025] p-5">
              <p className="mb-3 text-xs uppercase tracking-[0.18em] text-white/35">
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

      <section className="relative z-10 mx-auto max-w-6xl px-5 py-16">
        <div className="overflow-hidden rounded-lg border border-white/10 bg-white/[0.025] p-8 text-center sm:p-10">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-400/25 bg-violet-400/10 px-3 py-1.5 text-xs text-violet-200">
            <Workflow size={12} />
            Author your own workflow
          </div>
          <h2 className="mb-3 text-3xl font-medium text-white/90">
            Package your workflow as a GetSuperpower
          </h2>
          <p className="mx-auto mb-8 max-w-xl text-sm leading-6 text-white/45">
            Scaffold a bundle, define the entry skill, list sub-skills in workflow.json, validate,
            and share. The authoring guide keeps the skill tree aligned.
          </p>
          <div className="mx-auto grid max-w-3xl gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
            <TerminalBlock
              copyText="npx getsuperpower@latest init my-workflow"
              lines={[
                {
                  prefix: "$",
                  text: "npx getsuperpower@latest init my-workflow",
                },
              ]}
            />
            <a
              href={`${githubUrl}/blob/main/docs/workflow-author-guide.md`}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-white/10 px-5 py-3 text-sm text-white/62 transition hover:border-white/20 hover:text-white/85"
            >
              Author guide
              <ArrowRight size={14} />
            </a>
          </div>
        </div>
      </section>

      <footer className="relative z-10 mx-auto max-w-6xl border-t border-white/10 px-5 py-8">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2 text-sm text-white/35">
            <span className="flex h-5 w-5 items-center justify-center rounded bg-violet-500">
              <Zap size={10} className="text-white" />
            </span>
            GetSuperpower
          </div>
          <div className="flex items-center gap-6 text-xs text-white/30">
            <a href={githubUrl} className="transition hover:text-white/60">
              GitHub
            </a>
            <a href={`${githubUrl}/blob/main/README.md`} className="transition hover:text-white/60">
              Docs
            </a>
            <a
              href={`${githubUrl}/blob/main/docs/workflow-author-guide.md`}
              className="transition hover:text-white/60"
            >
              Author Guide
            </a>
          </div>
        </div>
      </footer>
    </main>
  );
}
