import { ArrowLeft, ArrowRight, ExternalLink, GitBranch, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyableInstallCommand } from "../../../components/copyable-install-command";
import { workflows } from "../../../lib/landing-content";

interface WorkflowPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return workflows.map((workflow) => ({
    slug: workflow.slug,
  }));
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { slug } = await params;
  const workflow = workflows.find((candidate) => candidate.slug === slug);

  if (!workflow) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[#080808] text-white">
      <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/#workflows"
          className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white/85"
        >
          <ArrowLeft size={14} />
          Back to workflows
        </Link>
        <a
          href={workflow.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white/85"
        >
          <GitBranch size={14} />
          View source on GitHub
          <ExternalLink size={13} />
        </a>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <span
            className={`inline-flex rounded-full border border-current/20 px-2 py-0.5 text-xs ${workflow.accent}`}
          >
            {workflow.tag}
          </span>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-white sm:text-5xl">
            {workflow.name}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/48">{workflow.description}</p>

          <div className="mt-8">
            <CopyableInstallCommand command={workflow.installCommand} />
          </div>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/35">
              <Zap size={13} className="text-amber-300" />
              entry skill
            </div>
            <code className={`mt-3 block break-all font-mono text-base ${workflow.accent}`}>
              ${workflow.entrySkill}
            </code>
          </div>
        </div>

        <aside className="rounded-lg border border-white/10 bg-white/[0.035] p-5">
          <div className="mb-5">
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">Workflow steps</p>
            <h2 className="text-xl font-medium text-white/90">Ordered skill path</h2>
          </div>

          <div className="space-y-3">
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
        </aside>
      </section>
    </main>
  );
}
