import { ArrowLeft, ArrowRight, ExternalLink, GitBranch, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CopyableInstallCommand } from "../../../components/copyable-install-command";
import { WorkflowAvatar } from "../../../components/workflow-avatar";
import { catalogEntries, getSkillSourceUrl } from "../../../lib/landing-content";

interface WorkflowPageProps {
  params: Promise<{
    slug: string;
  }>;
}

export function generateStaticParams() {
  return catalogEntries.map((entry) => ({
    slug: entry.slug,
  }));
}

export default async function WorkflowPage({ params }: WorkflowPageProps) {
  const { slug } = await params;
  const workflow = catalogEntries.find((candidate) => candidate.slug === slug);

  if (!workflow) {
    notFound();
  }

  const entrySkillSourceUrl = getSkillSourceUrl(workflow, workflow.entrySkill);

  return (
    <main className="min-h-screen bg-[#f6f4ef] text-[#191817]">
      <nav className="mx-auto flex max-w-6xl flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
        <Link
          href="/#workflows"
          className="inline-flex items-center gap-2 text-sm text-[var(--body)] transition-colors hover:text-[var(--ink)]"
        >
          <ArrowLeft size={14} />
          Back to workflows
        </Link>
        <a
          href={workflow.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 text-sm text-[var(--body)] transition-colors hover:text-[var(--ink)]"
        >
          <GitBranch size={14} />
          View source on GitHub
          <ExternalLink size={13} />
        </a>
      </nav>

      <section className="mx-auto grid max-w-6xl gap-10 px-5 py-16 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <WorkflowAvatar seed={workflow.avatarSeed} label={workflow.name} size={52} />
            <span
              className={`inline-flex rounded-full border border-current/20 px-2 py-0.5 text-xs ${workflow.accent}`}
            >
              {workflow.tag}
            </span>
          </div>
          <h1 className="mt-5 text-4xl font-semibold leading-tight text-[#191817] sm:text-5xl">
            {workflow.name}
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-[var(--body)]">
            {workflow.description}
          </p>

          <div className="mt-8">
            <CopyableInstallCommand command={workflow.installCommand} />
          </div>

          <div className="mt-8 rounded-md border border-[var(--rule)] bg-white p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              <Zap size={13} className="text-amber-300" />
              entry skill
            </div>
            {entrySkillSourceUrl ? (
              <a
                href={entrySkillSourceUrl}
                target="_blank"
                rel="noreferrer"
                className={`mt-3 inline-flex max-w-full items-center gap-2 break-all font-mono text-base transition hover:text-[#191817] ${workflow.accent}`}
              >
                ${workflow.entrySkill}
                <ExternalLink size={14} className="shrink-0" />
              </a>
            ) : (
              <code className={`mt-3 block break-all font-mono text-base ${workflow.accent}`}>
                ${workflow.entrySkill}
              </code>
            )}
          </div>
        </div>

        <aside className="rounded-md border border-[var(--rule)] bg-white p-5">
          <div className="mb-5">
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
              Workflow steps
            </p>
            <h2 className="text-xl font-medium text-[#191817]/90">Ordered skill path</h2>
          </div>

          <div className="space-y-3">
            {workflow.diagramSteps.map((step, index) => {
              const skillSourceUrl = getSkillSourceUrl(workflow, step.skill);
              return (
                <div key={`${step.label}-${step.skill}`} className="relative flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className="flex h-7 w-7 items-center justify-center rounded-md border border-[var(--rule)] bg-white text-xs text-[var(--muted)]">
                      {index + 1}
                    </span>
                    {index < workflow.diagramSteps.length - 1 ? (
                      <span className="my-1 h-full min-h-5 w-px bg-[#dedbd3]" />
                    ) : null}
                  </div>
                  <div className="pb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-medium text-[#191817]/82">{step.label}</p>
                      <ArrowRight size={12} className="text-[var(--faint)]" />
                      {skillSourceUrl ? (
                        <a
                          href={skillSourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded bg-[#f0ede6] px-1.5 py-0.5 font-mono text-xs text-[var(--body)] transition-colors hover:text-[var(--ink)]"
                        >
                          {step.skill}
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <code className="rounded bg-[#f0ede6] px-1.5 py-0.5 font-mono text-xs text-[var(--body)]">
                          {step.skill}
                        </code>
                      )}
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[var(--body)]">{step.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
    </main>
  );
}
