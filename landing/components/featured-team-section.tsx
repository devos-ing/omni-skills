import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import { featuredTeamSectionContent, type TeamCardContent } from "../lib/landing-content";
import { Reveal } from "./reveal";
import { TerminalBlock } from "./terminal-block";
import { WorkflowAvatar } from "./workflow-avatar";

export function FeaturedTeamSection({ teams }: { teams: readonly TeamCardContent[] }) {
  const [startupTeam, ...companionTeams] = teams;
  if (!startupTeam) return null;

  return (
    <section
      id="workflows"
      aria-labelledby="teams-heading"
      className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-16 sm:py-20"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        {featuredTeamSectionContent.eyebrow}
      </p>
      <h2 id="teams-heading" className="mt-3 text-3xl font-semibold text-[var(--ink)] sm:text-4xl">
        {featuredTeamSectionContent.heading}
      </h2>
      <p className="mt-4 max-w-3xl text-sm leading-6 text-[var(--body)]">
        {featuredTeamSectionContent.lead}
      </p>

      <Reveal className="mt-10 space-y-5" index={0}>
        <article
          aria-labelledby="startup-team-heading"
          className="grid overflow-hidden rounded-md border border-[var(--rule)] bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        >
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <WorkflowAvatar seed={startupTeam.avatarSeed} label={startupTeam.name} size={48} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  {featuredTeamSectionContent.featuredLabel}
                </p>
                <h3
                  id="startup-team-heading"
                  className="mt-1 text-2xl font-semibold text-[var(--ink)]"
                >
                  {startupTeam.name}
                </h3>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--body)]">{startupTeam.description}</p>
            <div className="mt-6">
              <TerminalBlock
                compact
                copyText={startupTeam.installCommand}
                copyLabel={featuredTeamSectionContent.copyInstallLabel}
                lines={[{ prefix: "$", text: startupTeam.installCommand }]}
              />
            </div>
            <TeamActions team={startupTeam} />
          </div>

          <div className="border-t border-[var(--rule)] bg-[#f0ede6]/45 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <dl>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                {featuredTeamSectionContent.coordinatorLabel}
              </dt>
              <dd className="mt-3">
                <code className="font-mono text-sm font-semibold text-[var(--ink)]">
                  {`$${startupTeam.coordinator.skill}`}
                </code>
                <p className="mt-1 text-sm leading-6 text-[var(--body)]">
                  {startupTeam.coordinator.description}
                </p>
              </dd>
            </dl>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              {featuredTeamSectionContent.membersLabel}
            </p>
            <ul className="mt-3 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
              {startupTeam.members.map((member) => (
                <li
                  key={member.skill}
                  className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)]"
                >
                  <span className="text-sm font-medium text-[var(--ink)]">{member.name}</span>
                  <span className="text-sm leading-5 text-[var(--body)]">{member.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>

        <div className="grid gap-5 lg:grid-cols-2">
          {companionTeams.map((team) => (
            <article
              key={team.slug}
              className="rounded-md border border-[var(--rule)] bg-white p-6 sm:p-7"
            >
              <div className="flex items-center gap-4">
                <WorkflowAvatar seed={team.avatarSeed} label={team.name} size={42} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                    Research team
                  </p>
                  <h3 className="mt-1 text-xl font-semibold text-[var(--ink)]">{team.name}</h3>
                </div>
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--body)]">{team.description}</p>
              <div className="mt-5 rounded-md bg-[var(--paper)] p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.13em] text-[var(--muted)]">
                  Coordinator
                </p>
                <code className="mt-2 block font-mono text-sm text-[var(--ink)]">{`$${team.coordinator.skill}`}</code>
                <p className="mt-3 text-xs leading-5 text-[var(--body)]">
                  {team.members.map(({ name }) => name).join(" · ")}
                </p>
              </div>
              <div className="mt-5">
                <TerminalBlock
                  compact
                  copyText={team.installCommand}
                  copyLabel={`Copy ${team.name} install command`}
                  lines={[{ prefix: "$", text: team.installCommand }]}
                />
              </div>
              <TeamActions team={team} />
            </article>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function TeamActions({ team }: { team: TeamCardContent }) {
  return (
    <div className="mt-5 flex flex-wrap gap-4">
      <Link
        href={`/workflows/${team.slug}`}
        className="editorial-control fine-pointer-arrow inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--ink)]"
      >
        {featuredTeamSectionContent.viewTeamLabel}
        <ArrowRight
          size={14}
          className="fine-pointer-arrow-icon transition-transform duration-150"
        />
      </Link>
      <a
        href={team.sourceUrl}
        target="_blank"
        rel="noreferrer"
        aria-label={`View ${team.name} source (opens in a new tab)`}
        className="editorial-control inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--body)] hover:text-[var(--ink)]"
      >
        {featuredTeamSectionContent.viewTeamSourceLabel}
        <ExternalLink size={13} />
      </a>
    </div>
  );
}
