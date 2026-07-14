# Landing Teams and Skill Hub Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the Omniskills landing catalog into a featured Startup Team section and an accessible, searchable Workflow/Skill Hub without changing runtime installation behavior.

**Architecture:** Keep package and skill data local and deterministic. Split the existing mixed catalog into a typed `startupTeam`, standalone `workflows`, and shared `catalogEntries` list; derive canonical, deduplicated skill rows in a pure helper module. Keep state in `LandingPage` while focused presentational components own the featured-team composition, tabs, and skill rows.

**Tech Stack:** Bun, TypeScript, React 19, Next.js 16, Tailwind CSS 4, Bun test.

---

## File map

- Create `tests/landing-skill-hub.test.ts`: behavioral tests for team typing, manifest parity, canonical skill sources, deduplication, and package relationships.
- Modify `tests/landing-app.test.ts`: source-contract coverage for section hierarchy, accessible tabs/search, responsive markup, truthful actions, content mirrors, and motion constraints.
- Modify `landing/lib/landing-content.ts`: discriminated team/workflow content, exact team roster, standalone workflows, and shared route catalog.
- Create `landing/lib/skill-hub.ts`: pure canonical-source and deduplication logic.
- Create `landing/components/featured-team-section.tsx`: Startup Team editorial feature and semantic role ledger.
- Create `landing/components/skill-hub.tsx`: tab/search/result presentation and keyboard behavior.
- Create `landing/components/skill-row.tsx`: source-only skill result.
- Modify `landing/components/landing-page.tsx`: navigation copy, hub state/filtering, and new section composition.
- Modify `landing/app/workflows/[slug]/page.tsx`: keep static team and workflow detail routes backed by `catalogEntries`.
- Modify `landing/design.md`: durable team/Skill Hub hierarchy and interaction contract.
- Modify `docs/landing-content.md`: English visible-copy mirror.
- Modify `docs/landing-content.zh-Hant.md`: Traditional Chinese visible-copy mirror.

No package or dependency change is required.

### Task 1: Model teams and derive a truthful skill catalog

**Files:**
- Create: `tests/landing-skill-hub.test.ts`
- Modify: `tests/landing-app.test.ts`
- Modify: `landing/lib/landing-content.ts`
- Create: `landing/lib/skill-hub.ts`
- Modify: `landing/app/workflows/[slug]/page.tsx`

- [ ] **Step 1: Write the failing behavioral tests**

Create `tests/landing-skill-hub.test.ts` with:

```ts
import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  catalogEntries,
  startupTeam,
  workflows,
  type CatalogEntryContent,
} from "../landing/lib/landing-content";
import { buildSkillHubEntries } from "../landing/lib/skill-hub";

const repoRoot = join(import.meta.dir, "..");

function manifestPath(entry: CatalogEntryContent) {
  const folder = entry.kind === "team" ? "teams" : "workflows";
  return join(repoRoot, "examples", folder, entry.slug, "workflow.json");
}

function localName(source: string) {
  return source.startsWith("./skills/") ? source.slice("./skills/".length) : source;
}

describe("landing teams and skill hub data", () => {
  test("models Startup Team separately from standalone workflows", () => {
    expect(startupTeam.kind).toBe("team");
    expect(startupTeam.coordinator.skill).toBe("startup-goal");
    expect(startupTeam.members.map(({ skill }) => skill)).toEqual([
      "ceo",
      "cto",
      "product-manager",
      "web-design",
      "engineering-manager",
      "founding-engineer",
      "qa-lead",
    ]);
    expect(workflows.every(({ kind }) => kind === "workflow")).toBe(true);
    expect(workflows.some(({ slug }) => slug === "startup-team")).toBe(false);
    expect(catalogEntries[0]).toBe(startupTeam);
  });

  test("mirrors every displayed package manifest skill roster", () => {
    for (const entry of catalogEntries) {
      const manifest = JSON.parse(readFileSync(manifestPath(entry), "utf8")) as {
        skills: Array<{ source: string }>;
      };
      expect(entry.skills.map(({ name }) => name)).toEqual(
        manifest.skills.map(({ source }) => localName(source)),
      );
    }
  });

  test("mirrors the Startup Team coordinator and member manifest fields", () => {
    const manifest = JSON.parse(readFileSync(manifestPath(startupTeam), "utf8")) as {
      coordinator: string;
      members: string[];
    };
    expect(startupTeam.coordinator.skill).toBe(localName(manifest.coordinator));
    expect(startupTeam.members.map(({ skill }) => skill)).toEqual(
      manifest.members.map((source) => localName(source)),
    );
  });

  test("deduplicates skills by canonical source and records package use", () => {
    const skills = buildSkillHubEntries(catalogEntries);
    expect(new Set(skills.map(({ id }) => id)).size).toBe(skills.length);

    const cto = skills.find(({ name }) => name === "cto");
    expect(cto?.usedBy.map(({ name }) => name)).toEqual(["Startup Team", "CTO"]);
    expect(cto?.sourceUrl).toContain("/examples/workflows/cto/skills/cto/SKILL.md");

    const implement = skills.find(({ name }) => name === "mattpocock:implement");
    expect(implement?.usedBy.map(({ name }) => name)).toEqual([
      "Startup Team",
      "Founding Engineer",
    ]);
  });

  test("gives every visible skill a canonical source-only destination", () => {
    const skills = buildSkillHubEntries(catalogEntries);
    const expectedNames = new Set(
      catalogEntries.flatMap((entry) =>
        entry.skills.map(({ name }) => (name === "implement" ? "mattpocock:implement" : name)),
      ),
    );
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.map(({ name }) => name)).toEqual([...expectedNames].sort((a, b) => a.localeCompare(b)));
    for (const skill of skills) {
      expect(skill.provider.length).toBeGreaterThan(0);
      expect(skill.sourceUrl.startsWith("https://github.com/")).toBe(true);
      expect(skill.sourceUrl.endsWith("/SKILL.md")).toBe(true);
      expect(skill.usedBy.length).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run the new test and verify the red state**

Run:

```bash
rtk bun test tests/landing-skill-hub.test.ts
```

Expected: FAIL because `catalogEntries`, `startupTeam`, `CatalogEntryContent`, and `landing/lib/skill-hub.ts` do not exist yet.

- [ ] **Step 3: Add the discriminated catalog types**

In `landing/lib/landing-content.ts` replace the current `WorkflowCardContent` declaration with:

```ts
interface CatalogEntryBase {
  slug: string;
  name: string;
  description: string;
  entrySkill: string;
  localSkillNames: string[];
  avatarSeed: string;
  tag: string;
  accent: string;
  sourceUrl: string;
  installCommand: string;
  skills: WorkflowSkill[];
  diagramSteps: WorkflowDiagramStep[];
}

export interface TeamRoleContent {
  name: string;
  skill: string;
  description: string;
}

export interface WorkflowCardContent extends CatalogEntryBase {
  kind: "workflow";
}

export interface TeamCardContent extends CatalogEntryBase {
  kind: "team";
  coordinator: TeamRoleContent;
  members: TeamRoleContent[];
}

export type CatalogEntryContent = TeamCardContent | WorkflowCardContent;
```

Change `getLocalSkillSourceUrl` to accept `CatalogEntryContent`.

- [ ] **Step 4: Split the Startup Team from standalone workflows**

Change the existing array opening:

```ts
export const workflows: WorkflowCardContent[] = [
  {
    slug: "startup-team",
```

to:

```ts
export const startupTeam: TeamCardContent = {
  kind: "team",
  slug: "startup-team",
```

Add these fields immediately after `entrySkill: "startup-goal"`:

```ts
  coordinator: {
    name: "Startup Goal",
    skill: "startup-goal",
    description: "Clarifies the brief, selects the needed roles, and combines their outputs.",
  },
  members: [
    { name: "CEO", skill: "ceo", description: "Company direction and tradeoffs" },
    { name: "CTO", skill: "cto", description: "Architecture and technical risk" },
    {
      name: "Product Manager",
      skill: "product-manager",
      description: "Discovery, PRDs, and issue slicing",
    },
    {
      name: "Web Design",
      skill: "web-design",
      description: "Interface direction and motion quality",
    },
    {
      name: "Engineering Manager",
      skill: "engineering-manager",
      description: "Delivery sequencing and quality gates",
    },
    {
      name: "Founding Engineer",
      skill: "founding-engineer",
      description: "Implementation framing and handoff",
    },
    {
      name: "QA Lead",
      skill: "qa-lead",
      description: "Acceptance checks and release risk",
    },
  ],
```

Replace the Startup Team description with the approved benefit copy:

```ts
  description:
    "Move one startup goal from direction to delivery with a coordinator that brings in strategy, product, design, engineering, and QA only when the work needs them.",
```

Close the team object immediately before the CEO object, then reopen the standalone array:

```ts
};

export const workflows: WorkflowCardContent[] = [
  {
    kind: "workflow",
    slug: "ceo",
```

Add `kind: "workflow"` before the slug in the CTO, Product Manager, Engineering Manager, Founding Engineer, QA Lead, and Haaland objects. After the standalone array, add:

```ts
export const catalogEntries: CatalogEntryContent[] = [startupTeam, ...workflows];
```

- [ ] **Step 5: Align displayed standalone skill rosters with their manifests**

Make these exact name replacements in both `skills` and `diagramSteps` where the old name appears:

```text
CEO: mattpocock:decision-mapping -> mattpocock:wayfinder
CTO: mattpocock:review -> mattpocock:code-review
Product Manager: mattpocock:to-prd -> mattpocock:to-spec
Product Manager: mattpocock:to-issues -> mattpocock:to-tickets
Engineering Manager: mattpocock:review -> mattpocock:code-review
Founding Engineer: mattpocock:review -> mattpocock:code-review
QA Lead: mattpocock:review -> mattpocock:code-review
```

Use these matching descriptions:

```ts
{ name: "mattpocock:wayfinder", description: "Map strategic uncertainty" }
{ name: "mattpocock:code-review", description: "Review behavior and risk" }
{ name: "mattpocock:to-spec", description: "Write the product specification" }
{ name: "mattpocock:to-tickets", description: "Slice delivery tickets" }
```

Do not change the Founding Engineer manifest's bare `implement` entry in this task; canonicalization in the next step maps it to the same public source as `mattpocock:implement` for display.

- [ ] **Step 6: Implement canonical skill-source derivation**

Create `landing/lib/skill-hub.ts`:

```ts
import {
  catalogEntries,
  getLocalSkillSourceUrl,
  githubUrl,
  type CatalogEntryContent,
  type WorkflowSkill,
} from "./landing-content";

export interface SkillHubRelationship {
  slug: string;
  name: string;
  kind: "team" | "workflow";
}

export interface SkillHubEntry {
  id: string;
  name: string;
  description: string;
  provider: string;
  sourceUrl: string;
  usedBy: SkillHubRelationship[];
}

const providerSources: Record<string, { provider: string; root: string }> = {
  emilkowalski: {
    provider: "emilkowalski/skills",
    root: "https://github.com/emilkowalski/skills/blob/main/skills",
  },
  superpowers: {
    provider: "obra/superpowers",
    root: "https://github.com/obra/superpowers/blob/main/skills",
  },
  mattpocock: {
    provider: "mattpocock/skills@v1.1.0",
    root: "https://github.com/mattpocock/skills/blob/v1.1.0/skills",
  },
};

const aliases: Record<string, string> = {
  implement: "mattpocock:implement",
};

const localSourceOverrides: Record<string, string> = {
  "web-design": `${githubUrl}/blob/main/examples/workflows/web-design/skills/web-design/SKILL.md`,
};

function canonicalName(name: string) {
  return aliases[name] ?? name;
}

function externalSource(name: string) {
  const separator = name.indexOf(":");
  if (separator < 1) return null;
  const providerKey = name.slice(0, separator);
  const skillName = name.slice(separator + 1);
  const provider = providerSources[providerKey];
  if (!provider || !skillName) return null;
  return {
    provider: provider.provider,
    sourceUrl: `${provider.root}/${skillName}/SKILL.md`,
  };
}

function sourceFor(
  entries: CatalogEntryContent[],
  packageEntry: CatalogEntryContent,
  skill: WorkflowSkill,
) {
  const name = canonicalName(skill.name);
  const external = externalSource(name);
  if (external) return { name, ...external };

  const standalone = entries.find(
    (entry) => entry.kind === "workflow" && entry.entrySkill === name,
  );
  const sourceUrl =
    localSourceOverrides[name] ??
    (standalone ? getLocalSkillSourceUrl(standalone, name) : null) ??
    getLocalSkillSourceUrl(packageEntry, skill.name);

  if (!sourceUrl) return null;
  return { name, provider: "devos-ing/omni-skills", sourceUrl };
}

export function buildSkillHubEntries(entries: CatalogEntryContent[]) {
  const bySource = new Map<string, SkillHubEntry>();

  for (const packageEntry of entries) {
    for (const skill of packageEntry.skills) {
      const source = sourceFor(entries, packageEntry, skill);
      if (!source) continue;
      const relationship: SkillHubRelationship = {
        slug: packageEntry.slug,
        name: packageEntry.name,
        kind: packageEntry.kind,
      };
      const existing = bySource.get(source.sourceUrl);
      if (existing) {
        if (!existing.usedBy.some(({ slug }) => slug === packageEntry.slug)) {
          existing.usedBy.push(relationship);
        }
        continue;
      }
      bySource.set(source.sourceUrl, {
        id: source.sourceUrl,
        name: source.name,
        description: skill.description,
        provider: source.provider,
        sourceUrl: source.sourceUrl,
        usedBy: [relationship],
      });
    }
  }

  return [...bySource.values()].sort((left, right) => left.name.localeCompare(right.name));
}

export const skillHubEntries = buildSkillHubEntries(catalogEntries);
```

- [ ] **Step 7: Keep detail routes available for both kinds**

In `landing/app/workflows/[slug]/page.tsx` replace the `workflows` import and both route lookups with `catalogEntries`:

```ts
import { catalogEntries, getLocalSkillSourceUrl } from "../../../lib/landing-content";

export function generateStaticParams() {
  return catalogEntries.map((entry) => ({ slug: entry.slug }));
}

const workflow = catalogEntries.find((candidate) => candidate.slug === slug);
```

Keep the existing `/#workflows` back link and install/detail behavior unchanged.

In the existing `renders static workflow detail routes from local workflow data`
test in `tests/landing-app.test.ts`, replace:

```ts
expect(route).toContain("workflows.map");
expect(route).toContain("workflows.find");
```

with:

```ts
expect(route).toContain("catalogEntries.map");
expect(route).toContain("catalogEntries.find");
```

- [ ] **Step 8: Run the focused behavioral tests**

Run:

```bash
rtk bun test tests/landing-skill-hub.test.ts tests/landing-app.test.ts
```

Expected: the new behavioral file passes. Existing source-contract failures are allowed only where Task 2 intentionally replaces the old single-registry wording.

- [ ] **Step 9: Commit the data slice**

```bash
rtk git add tests/landing-skill-hub.test.ts tests/landing-app.test.ts landing/lib/landing-content.ts landing/lib/skill-hub.ts 'landing/app/workflows/[slug]/page.tsx'
rtk git commit -m "feat: model landing teams and skill catalog"
```

### Task 2: Build the featured team and accessible Skill Hub

**Files:**
- Modify: `tests/landing-app.test.ts`
- Create: `landing/components/featured-team-section.tsx`
- Create: `landing/components/skill-hub.tsx`
- Create: `landing/components/skill-row.tsx`
- Modify: `landing/components/landing-page.tsx`

- [ ] **Step 1: Replace the obsolete registry assertions with failing section contracts**

In `tests/landing-app.test.ts` replace the test named `keeps workflow browsing route-only on the landing page` with three tests that assert:

```ts
test("features Startup Team before the searchable Skill Hub", () => {
  const page = readLandingFile("components/landing-page.tsx");
  const team = readLandingFile("components/featured-team-section.tsx");
  const hub = readLandingFile("components/skill-hub.tsx");

  expect(page).toContain("<FeaturedTeamSection");
  expect(page).toContain("<SkillHub");
  expect(page).toContain("Explore teams & skills");
  expect(team).toContain('id="workflows"');
  expect(team).toContain("Pick an Omniskills team");
  expect(team).toContain("View team");
  expect(team).toContain("View team source");
  expect(team).toContain("team.coordinator");
  expect(team).toContain("team.members.map");
  expect(hub).toContain('id="skill-hub"');
  expect(hub).toContain("Explore the Skill Hub");
  expect(page.indexOf("<FeaturedTeamSection")).toBeLessThan(page.indexOf("<SkillHub"));
});

test("implements keyboard-accessible Workflow and Skill tabs", () => {
  const hub = readLandingFile("components/skill-hub.tsx");

  expect(hub).toContain('role="tablist"');
  expect(hub).toContain('role="tab"');
  expect(hub).toContain('role="tabpanel"');
  expect(hub).toContain("aria-selected");
  expect(hub).toContain("aria-controls");
  expect(hub).toContain('event.key === "ArrowRight"');
  expect(hub).toContain('event.key === "ArrowLeft"');
  expect(hub).toContain('event.key === "Home"');
  expect(hub).toContain('event.key === "End"');
  expect(hub).toContain('type="search"');
  expect(hub).toContain('aria-live="polite"');
  expect(hub).toContain("Clear workflow search");
  expect(hub).toContain("Clear skill search");
});

test("keeps skill results source-only and unanimated while filtering", () => {
  const row = readLandingFile("components/skill-row.tsx");
  const hub = readLandingFile("components/skill-hub.tsx");

  expect(row).toContain("View skill source");
  expect(row).toContain("entry.usedBy");
  expect(row).toContain('target="_blank"');
  expect(row).toContain('rel="noreferrer"');
  expect(row).not.toContain("installCommand");
  expect(row).not.toContain("Copy");
  expect(hub).not.toContain("<Reveal");
  expect(hub).not.toContain("motion-registry-row");
  expect(hub).not.toContain("editorial-control");
});
```

In `uses readable editorial tokens and a registry-first hierarchy`, replace the
old `registryIndex` assertions with:

```ts
const teamIndex = page.indexOf("<FeaturedTeamSection");
const hubIndex = page.indexOf("<SkillHub");
const demoIndex = page.indexOf('id="workflow-example"');
expect(teamIndex).toBeGreaterThan(-1);
expect(hubIndex).toBeGreaterThan(teamIndex);
expect(demoIndex).toBeLessThan(teamIndex);
```

In `uses finite, accessible product-demo motion`, read
`components/featured-team-section.tsx` into `featuredTeam`, include it in
`motionSources`, remove `expect(page).toContain("motion-registry-row")`, and add:

```ts
expect(featuredTeam).toContain("<Reveal");
expect(page).not.toContain("motion-registry-row");
```

In `renders a parallel startup-goal chat with case and checkpoint rails`,
replace `workflowsIndex` with:

```ts
const teamIndex = page.indexOf("<FeaturedTeamSection");
expect(teamIndex).toBeGreaterThan(-1);
expect(demoIndex).toBeLessThan(teamIndex);
```

- [ ] **Step 2: Run the source-contract test and verify the red state**

Run:

```bash
rtk bun test tests/landing-app.test.ts
```

Expected: FAIL because the three new components and new landing copy do not exist.

- [ ] **Step 3: Create the source-only skill row**

Create `landing/components/skill-row.tsx`:

```tsx
import { ArrowUpRight } from "lucide-react";
import type { SkillHubEntry } from "../lib/skill-hub";

export function SkillRow({ entry }: { entry: SkillHubEntry }) {
  const relationships = entry.usedBy.map(({ name }) => name).join(" · ");

  return (
    <article className="grid gap-4 border-b border-[var(--rule)] py-5 md:grid-cols-[minmax(0,1fr)_auto] md:items-center">
      <div className="min-w-0">
        <h3 className="break-words font-mono text-sm font-semibold text-[var(--ink)]">
          ${entry.name}
        </h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-[var(--body)]">
          ${entry.description}
        </p>
        <p className="mt-3 text-xs leading-5 text-[var(--muted)]">
          ${entry.provider} · Included in ${relationships}
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
        <ArrowUpRight size={14} className="fine-pointer-arrow-icon transition-transform duration-150" />
      </a>
    </article>
  );
}
```

- [ ] **Step 4: Create the featured Startup Team composition**

Create `landing/components/featured-team-section.tsx` with:

```tsx
import { ArrowRight, ExternalLink } from "lucide-react";
import Link from "next/link";
import type { TeamCardContent } from "../lib/landing-content";
import { Reveal } from "./reveal";
import { TerminalBlock } from "./terminal-block";
import { WorkflowAvatar } from "./workflow-avatar";

export function FeaturedTeamSection({ team }: { team: TeamCardContent }) {
  return (
    <section
      id="workflows"
      aria-labelledby="teams-heading"
      className="mx-auto max-w-6xl border-t border-[var(--rule)] px-5 py-16 sm:py-20"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">
        Omniskills Teams
      </p>
      <h2
        id="teams-heading"
        className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-4xl"
      >
        Pick an Omniskills team
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--body)]">
        Start with a coordinated team when one role is not enough. One install gives your agent a
        coordinator, specialist roles, and the playbooks that connect them.
      </p>

      <Reveal className="mt-10" index={0}>
        <article
          aria-labelledby="startup-team-heading"
          className="grid overflow-hidden rounded-md border border-[var(--rule)] bg-white lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]"
        >
          <div className="p-6 sm:p-8">
            <div className="flex items-center gap-4">
              <WorkflowAvatar seed={team.avatarSeed} label={team.name} size={48} />
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                  Featured team
                </p>
                <h3 id="startup-team-heading" className="mt-1 text-2xl font-semibold text-[var(--ink)]">
                  {team.name}
                </h3>
              </div>
            </div>
            <p className="mt-5 text-sm leading-6 text-[var(--body)]">{team.description}</p>
            <div className="mt-6">
              <TerminalBlock
                compact
                copyText={team.installCommand}
                copyLabel="Copy Startup Team install command"
                lines={[{ prefix: "$", text: team.installCommand }]}
              />
            </div>
            <div className="mt-5 flex flex-wrap gap-4">
              <Link
                href={`/workflows/${team.slug}`}
                className="editorial-control fine-pointer-arrow inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--ink)]"
              >
                View team
                <ArrowRight size={14} className="fine-pointer-arrow-icon transition-transform duration-150" />
              </Link>
              <a
                href={team.sourceUrl}
                target="_blank"
                rel="noreferrer"
                aria-label={`View ${team.name} source (opens in a new tab)`}
                className="editorial-control inline-flex min-h-11 items-center gap-2 text-sm font-medium text-[var(--body)] hover:text-[var(--ink)]"
              >
                View team source
                <ExternalLink size={13} />
              </a>
            </div>
          </div>

          <div className="border-t border-[var(--rule)] bg-[#f0ede6]/45 p-6 sm:p-8 lg:border-l lg:border-t-0">
            <dl>
              <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
                Coordinator
              </dt>
              <dd className="mt-3">
                <code className="font-mono text-sm font-semibold text-[var(--ink)]">
                  ${team.coordinator.skill}
                </code>
                <p className="mt-1 text-sm leading-6 text-[var(--body)]">
                  {team.coordinator.description}
                </p>
              </dd>
            </dl>
            <p className="mt-7 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
              Members
            </p>
            <ul className="mt-3 divide-y divide-[var(--rule)] border-y border-[var(--rule)]">
              {team.members.map((member) => (
                <li key={member.skill} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
                  <span className="text-sm font-medium text-[var(--ink)]">{member.name}</span>
                  <span className="text-sm leading-5 text-[var(--body)]">{member.description}</span>
                </li>
              ))}
            </ul>
          </div>
        </article>
      </Reveal>
    </section>
  );
}
```

- [ ] **Step 5: Create the accessible tabbed hub**

Create `landing/components/skill-hub.tsx` with:

```tsx
import { Search, X } from "lucide-react";
import type { KeyboardEvent } from "react";
import type { WorkflowCardContent } from "../lib/landing-content";
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
  { id: "workflows", label: "Workflows" },
  { id: "skills", label: "Skills" },
];

export function SkillHub({
  activeTab,
  query,
  workflows,
  skills,
  onTabChange,
  onQueryChange,
}: SkillHubProps) {
  const count = activeTab === "workflows" ? workflows.length : skills.length;
  const noun = activeTab === "workflows" ? "workflow" : "skill";
  const placeholder =
    activeTab === "workflows"
      ? "Search workflows, entry skills, or tags..."
      : "Search skills, providers, or packages...";
  const clearLabel = activeTab === "workflows" ? "Clear workflow search" : "Clear skill search";

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
            Skill Hub
          </p>
          <h2
            id="skill-hub-heading"
            className="mt-3 text-3xl font-semibold tracking-[-0.025em] text-[var(--ink)] sm:text-4xl"
          >
            Explore the Skill Hub
          </h2>
          <p className="mt-4 max-w-xl text-sm leading-6 text-[var(--body)]">
            Browse independently installable workflows or inspect the skills they assemble.
          </p>
        </div>
        <div>
          <div
            role="tablist"
            aria-label="Skill Hub catalog"
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
                className={`min-h-11 border-b-2 px-4 text-sm font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] ${
                  activeTab === tab.id
                    ? "border-[var(--accent)] text-[var(--ink)]"
                    : "border-transparent text-[var(--muted)]"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <label htmlFor="skill-hub-search" className="sr-only">
            Search {activeTab}
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
              placeholder={placeholder}
              className="min-h-11 w-full rounded-md border border-[var(--rule)] bg-white py-3 pl-9 pr-9 text-sm text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/20"
            />
            {query ? (
              <button
                type="button"
                onClick={() => onQueryChange("")}
                aria-label={clearLabel}
                className="absolute right-2 top-1/2 flex min-h-11 min-w-11 -translate-y-1/2 items-center justify-center text-[var(--muted)] transition-colors duration-150 hover:text-[var(--ink)]"
              >
                <X size={14} />
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {count} {noun} {count === 1 ? "result" : "results"}
      </p>
      <div
        id="hub-panel-workflows"
        role="tabpanel"
        aria-labelledby="hub-tab-workflows"
        hidden={activeTab !== "workflows"}
        className="mt-10 border-t border-[var(--rule)]"
      >
        {workflows.map((workflow) => <WorkflowCard key={workflow.slug} {...workflow} />)}
        {activeTab === "workflows" && count === 0 ? (
          <div className="border-b border-[var(--rule)] px-5 py-14 text-center text-[var(--body)]">
            <Search size={26} className="mx-auto mb-3 text-[var(--faint)]" />
            <p className="text-sm">
              No workflows match <span className="font-medium text-[var(--ink)]">"{query}"</span>.
            </p>
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="mt-3 min-h-11 text-sm font-medium text-[var(--accent-pressed)] transition-colors duration-150 hover:text-[var(--ink)]"
            >
              Clear search
            </button>
          </div>
        ) : null}
      </div>
      <div
        id="hub-panel-skills"
        role="tabpanel"
        aria-labelledby="hub-tab-skills"
        hidden={activeTab !== "skills"}
        className="mt-10 border-t border-[var(--rule)]"
      >
        {skills.map((skill) => <SkillRow key={skill.id} entry={skill} />)}
        {activeTab === "skills" && count === 0 ? (
          <div className="border-b border-[var(--rule)] px-5 py-14 text-center text-[var(--body)]">
            <Search size={26} className="mx-auto mb-3 text-[var(--faint)]" />
            <p className="text-sm">
              No skills match <span className="font-medium text-[var(--ink)]">"{query}"</span>.
            </p>
            <button
              type="button"
              onClick={() => onQueryChange("")}
              className="mt-3 min-h-11 text-sm font-medium text-[var(--accent-pressed)] transition-colors duration-150 hover:text-[var(--ink)]"
            >
              Clear search
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Integrate the new sections and filtering**

In `landing/components/landing-page.tsx`:

1. Remove `Search` and `X` from the Lucide import.
2. Import `FeaturedTeamSection`, `SkillHub`, `HubTab`, `skillHubEntries`, and `startupTeam`.
3. Add `const [activeHubTab, setActiveHubTab] = useState<HubTab>("workflows");`.
4. Keep the existing `query` state across tab changes.
5. Keep `filteredWorkflows` but operate on standalone `workflows` only.
6. Add:

```tsx
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
```

7. Rename the nav link to `Teams & skills` and hero CTA to `Explore teams & skills` while retaining `href="#workflows"`.
8. Replace the old `section id="workflows"` block with:

```tsx
<FeaturedTeamSection team={startupTeam} />
<SkillHub
  activeTab={activeHubTab}
  query={query}
  workflows={filteredWorkflows}
  skills={filteredSkills}
  onTabChange={setActiveHubTab}
  onQueryChange={setQuery}
/>
```

Do not change the hero, workflow demo, install guide, authoring section, or footer.

- [ ] **Step 7: Run focused tests and landing compilation**

Run:

```bash
rtk bun test tests/landing-skill-hub.test.ts tests/landing-app.test.ts
rtk bun run typecheck # run from landing/
```

Expected: both test files pass and typecheck exits 0.

- [ ] **Step 8: Commit the interface slice**

```bash
rtk git add tests/landing-app.test.ts landing/components/featured-team-section.tsx landing/components/skill-hub.tsx landing/components/skill-row.tsx landing/components/landing-page.tsx
rtk git commit -m "feat: add landing teams and skill hub"
```

### Task 3: Update durable design and agent-readable landing content

**Files:**
- Modify: `tests/landing-app.test.ts`
- Modify: `landing/design.md`
- Modify: `docs/landing-content.md`
- Modify: `docs/landing-content.zh-Hant.md`

- [ ] **Step 1: Add failing content-mirror assertions**

Add a test to `tests/landing-app.test.ts` that reads all three documents and requires:

```ts
test("documents the featured team and Skill Hub in both content mirrors", () => {
  const design = readLandingFile("design.md");
  const english = readFileSync(join(repoRoot, "docs", "landing-content.md"), "utf8");
  const traditionalChinese = readFileSync(
    join(repoRoot, "docs", "landing-content.zh-Hant.md"),
    "utf8",
  );

  for (const document of [design, english, traditionalChinese]) {
    expect(document).toContain("Pick an Omniskills team");
    expect(document).toContain("Explore the Skill Hub");
    expect(document).toContain("Workflows");
    expect(document).toContain("Skills");
    expect(document).toContain("View skill source");
    expect(document).not.toContain("Heading: Pick an Omniskills workflow");
  }
  expect(english).toContain("npx omniskill@latest install startup-team");
  expect(traditionalChinese).toContain("npx omniskill@latest install startup-team");
});
```

In the existing `documents the reference-derived registry design` test, replace
the `Workflow Registry` assertion with:

```ts
expect(design).toContain("Omniskills Teams");
expect(design).toContain("Skill Hub");
expect(design).toContain("landing/components/featured-team-section.tsx");
expect(design).toContain("landing/components/skill-hub.tsx");
expect(design).toContain("landing/components/skill-row.tsx");
```

- [ ] **Step 2: Run the content contract and verify the red state**

Run:

```bash
rtk bun test tests/landing-app.test.ts
```

Expected: FAIL on the old Workflow Registry headings.

- [ ] **Step 3: Update the durable design document**

In `landing/design.md`:

- replace the single Workflow Registry layout item with `Omniskills Teams` and `Skill Hub` items;
- replace the `## Workflow Registry` section with the approved team composition, Workflows/Skills tabs, retained query, keyboard behavior, source-only skill rows, 320px behavior, and no filtering animation;
- keep the existing no-fake-metrics, route, command, color, focus, and reduced-motion constraints;
- name `featured-team-section.tsx`, `skill-hub.tsx`, and `skill-row.tsx` as stable component boundaries.

- [ ] **Step 4: Update the English content mirror**

In `docs/landing-content.md` replace `## Workflow Registry` with:

1. `## Omniskills Teams` containing the approved eyebrow, `Pick an Omniskills team` heading, lead, Startup Team description, coordinator, seven members, install command, `View team`, and `View team source`.
2. `## Skill Hub` containing `Explore the Skill Hub`, the approved lead, Workflows and Skills tabs, both search placeholders, empty states, and `View skill source` behavior.
3. A workflow catalog that excludes Startup Team because it is already featured.
4. A skill-source contract explaining provider, package relationships, canonical deduplication, and no standalone install command.

Retain the full Startup Team skill roster under its featured-team entry so agent-readable content still mirrors the manifest.

- [ ] **Step 5: Update the Traditional Chinese mirror**

Apply the same structure and factual catalog to `docs/landing-content.zh-Hant.md`. Keep product labels and commands literal:

```text
Omniskills Teams
Pick an Omniskills team
Skill Hub
Explore the Skill Hub
Workflows
Skills
View team
View team source
View skill source
```

Translate explanatory prose into Traditional Chinese, but do not translate skill names, package names, paths, URLs, or commands.

- [ ] **Step 6: Run content and behavior checks**

Run:

```bash
rtk bun test tests/landing-app.test.ts tests/landing-skill-hub.test.ts
rtk proxy git diff --check
```

Expected: both test files pass and the diff check exits 0.

- [ ] **Step 7: Commit the content slice**

```bash
rtk git add tests/landing-app.test.ts landing/design.md docs/landing-content.md docs/landing-content.zh-Hant.md
rtk git commit -m "docs: update landing teams and skill hub content"
```

### Task 4: Review motion and verify the complete landing

**Files:**
- Modify only if findings require it: `landing/app/globals.css`, `landing/components/featured-team-section.tsx`, `landing/components/skill-hub.tsx`, `landing/components/skill-row.tsx`
- Test only if a regression is found: `tests/landing-app.test.ts`

- [ ] **Step 1: Run the required animation review**

Invoke `review-animations` against every changed animation and motion class. Produce one `Before | After | Why` table and an explicit **Approve** or **Block** verdict.

The review must confirm:

- the team reveal has a user-orientation purpose and occurs once;
- filtering and tabs have no positional animation;
- no `transition: all`, `ease-in`, `scale(0)`, layout-property animation, ambient loop, or ungated hover motion was introduced;
- reduced motion removes translation and stagger;
- press feedback stays at 140ms and fine-pointer arrow movement stays at 2px.

If the verdict is **Block**, add a focused failing source-contract assertion, make the smallest fix, rerun that test, and repeat the review. Do not proceed while blocked.

- [ ] **Step 2: Run focused tests, typecheck, and production build**

```bash
rtk bun test tests/landing-skill-hub.test.ts tests/landing-app.test.ts
rtk bun run typecheck # run from landing/
rtk bun run build     # run from landing/
```

Expected: all commands exit 0.

- [ ] **Step 3: Run browser smoke checks**

Start the landing app with:

```bash
rtk bun run dev # run from landing/
```

Check 320px, 768px, and desktop widths:

- Startup Team appears once and precedes the Skill Hub.
- The install command copies as a whole target.
- View team, View team source, workflow routes, and skill source links go to truthful destinations.
- Arrow Right/Left/Home/End select and focus tabs.
- Search text persists across tabs; both clear controls and empty states work.
- No horizontal overflow occurs; touch targets remain at least 44px.
- Focus is visible and filtering does not move focus or replay entrance motion.
- Reduced-motion emulation removes translation and stagger.

Stop the dev server after the smoke check.

- [ ] **Step 4: Run the full repository gate**

```bash
rtk bun run check
```

Expected: Biome, root TypeScript, all Bun tests, and the 90% coverage gate pass.

- [ ] **Step 5: Commit any review-only fixes**

If motion, smoke, formatting, or QA produced changes:

```bash
rtk git add landing/app/globals.css landing/components/featured-team-section.tsx landing/components/skill-hub.tsx landing/components/skill-row.tsx tests/landing-app.test.ts
rtk git commit -m "fix: polish landing team hub interactions"
```

If there are no review changes, do not create an empty commit.

- [ ] **Step 6: Record final release evidence**

The final handoff must list:

- active roles: founding engineer, web-design motion reviewer, QA lead;
- skipped roles and their unchanged re-entry conditions;
- each commit created by Tasks 1-4;
- focused test counts, landing typecheck/build results, full `rtk bun run check` result;
- browser widths checked and any residual source-link risk;
- explicit motion **Approve** verdict;
- confirmation that `docs/landing-content.md` and `docs/landing-content.zh-Hant.md` were updated.
