"use client";

import {
  ArrowRight,
  ChevronRight,
  Github,
  Layers,
  Package,
  Search,
  Workflow,
  X,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";
import {
  type AgentBadgeContent,
  agents,
  commands,
  githubUrl,
  howItWorks,
  workflows,
} from "../lib/landing-content";
import { FlowDiagram } from "./flow-diagram";
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

export function LandingPage() {
  const [activeCommand, setActiveCommand] = useState(0);
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
          <a href="#how-it-works" className="hidden transition hover:text-white/80 sm:inline">
            How it works
          </a>
          <a href="#install" className="transition hover:text-white/80">
            Install
          </a>
          <a
            href={githubUrl}
            className="inline-flex items-center gap-1.5 transition hover:text-white/80"
          >
            <Github size={15} />
            <span className="hidden sm:inline">GitHub</span>
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
          One command.
          <br />
          Whole workflow.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/48">
          GetSuperpower packages a complete AI-agent workflow as a single callable skill. Install
          once, invoke the entry skill, and the agent follows every required sub-skill in order.
        </p>
        <div className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <div className="rounded-lg border border-white/10 bg-[#0d0d0d] px-4 py-3 font-mono text-sm text-white/70">
            <span className="break-words">npx getsuperpower@latest install ...</span>
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

      <section id="how-it-works" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="mb-12 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/32">How it works</p>
          <h2 className="text-3xl font-medium text-white/90">
            Install the skill tree. Invoke once.
          </h2>
        </div>
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <FlowDiagram />
          <div className="space-y-6">
            {howItWorks.map((item, index) => {
              const icons = [Package, Zap, Layers];
              const Icon = icons[index] ?? Package;
              return (
                <div key={item.title} className="flex gap-4">
                  <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-white/55">
                    <Icon size={16} />
                  </div>
                  <div>
                    <h3 className="font-medium text-white/82">{item.title}</h3>
                    <p className="mt-1 text-sm leading-6 text-white/42">{item.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <WorkflowRunDemo />

      <section id="workflows" className="relative z-10 mx-auto max-w-6xl px-5 py-20">
        <div className="mb-10 text-center">
          <p className="mb-3 text-xs uppercase tracking-[0.22em] text-white/32">Workflow bundles</p>
          <h2 className="text-3xl font-medium text-white/90">Pick a GetSuperpower</h2>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-white/42">
            Each workflow is a shareable bundle of skills with one entry point.
          </p>
        </div>
        <div className="relative mx-auto mb-10 max-w-md">
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
        <div className="grid gap-4 md:grid-cols-2">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard key={workflow.slug} {...workflow} />
          ))}
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
              Install from npm, git, or a local path. The CLI handles validation, dependency
              resolution, and local workflow records under{" "}
              <code className="text-white/65">.getsuperpower/</code>.
            </p>
            <div className="space-y-2">
              {commands.map((command, index) => (
                <button
                  key={command.label}
                  type="button"
                  onClick={() => setActiveCommand(index)}
                  className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                    activeCommand === index
                      ? "border-violet-400/45 bg-violet-400/10 text-white/85"
                      : "border-white/10 bg-white/[0.025] text-white/45 hover:border-white/20 hover:text-white/70"
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span>{command.label}</span>
                    <ChevronRight
                      size={14}
                      className={activeCommand === index ? "text-violet-300" : "text-white/25"}
                    />
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
                    text: "$openspec-delivery implement this OpenSpec change",
                  },
                  { text: "", dim: true },
                  { text: "[ok] proposal   scoped the change", dim: true },
                  { text: "[ok] design     selected the approach", dim: true },
                  { text: "[ok] plan       wrote executable tasks", dim: true },
                  {
                    text: "[ok] TDD        built through public seams",
                    dim: true,
                  },
                  {
                    text: "[ok] archive    preserved project knowledge",
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
