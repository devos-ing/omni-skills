# Workflow Detail Routes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build route-only workflow detail pages so landing workflow cards navigate to `/workflows/[slug]`.

**Architecture:** The landing root page stays a browse/search surface. Workflow data remains local in `landing/lib/landing-content.ts`; cards link to dynamic static Next routes, and `landing/app/workflows/[slug]/page.tsx` resolves one workflow by slug or calls `notFound()`.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Tailwind CSS, Bun tests, OpenSpec.

---

## File Structure

- Modify: `tests/landing-app.test.ts`
  Source-contract tests for card route links, local workflow metadata, route page behavior, and removal of selected in-page detail state.
- Modify: `landing/lib/landing-content.ts`
  Add explicit workflow install commands so detail pages do not derive CLI commands from GitHub tree URLs.
- Modify: `landing/components/workflow-card.tsx`
  Convert the "View workflow" action from a selected-state button to a Next route link.
- Modify: `landing/components/landing-page.tsx`
  Remove selected workflow state, cleanup effect, and in-page `WorkflowDetail` rendering.
- Create: `landing/app/workflows/[slug]/page.tsx`
  Static dynamic route for workflow details.
- Modify: `openspec/changes/show-workflow-diagrams-on-landing/tasks.md`
  Mark implementation and verification tasks complete after checks pass.

## Public Test Seams

Before writing tests, confirm these seams are the intended public contract:

- `tests/landing-app.test.ts` source-contract tests are the focused landing seam for this repo.
- `WorkflowCard` should expose route links, not selected-state callbacks.
- `LandingPage` should render cards only, not own selected workflow detail state.
- `landing/app/workflows/[slug]/page.tsx` should own detail route behavior, including `generateStaticParams()` and `notFound()`.
- `landing/lib/landing-content.ts` should own install commands and workflow metadata.

### Task 1: Update Landing Source-Contract Tests

**Files:**
- Modify: `tests/landing-app.test.ts`

- [ ] **Step 1: Replace the workflow metadata test with route-detail metadata expectations**

Replace the existing test named `"defines workflow detail metadata for in-page diagrams"` with:

```ts
  test("defines workflow detail metadata for route pages", () => {
    const content = readLandingFile("lib/landing-content.ts");

    expect(content).toContain("export interface WorkflowDiagramStep");
    expect(content).toContain("slug: string");
    expect(content).toContain("sourceUrl: string");
    expect(content).toContain("installCommand: string");
    expect(content).toContain("diagramSteps: WorkflowDiagramStep[]");
    expect(content).toContain('slug: "openspec-delivery"');
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/openspec-superpowers`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/release-review`);
    expect(content).toContain(`\${githubUrl}/tree/main/examples/workflows/real-engineering`);
    expect(content).toContain(
      `\${githubUrl}/tree/main/examples/workflows/development-design-delivery`,
    );
    expect(content).toContain(
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'",
    );
    expect(content).toContain('label: "Proposal"');
    expect(content).toContain('skill: "opsx-handoff-review"');
  });
```

- [ ] **Step 2: Replace the card selector test with route-link expectations**

Replace the existing test named `"renders workflow cards as actionable selectors"` with:

```ts
  test("renders workflow cards as route links", () => {
    const card = readLandingFile("components/workflow-card.tsx");

    expect(card).toContain('import Link from "next/link"');
    expect(card).toContain('href={`/workflows/${slug}`}');
    expect(card).toContain("View workflow");
    expect(card).not.toContain("isSelected");
    expect(card).not.toContain("onViewWorkflow");
    expect(card).not.toContain('type="button"');
    expect(card).not.toContain("aria-pressed");
  });
```

- [ ] **Step 3: Replace the selected-detail test with route-only landing expectations**

Replace the existing test named `"renders selected workflow details with GitHub source links"` with:

```ts
  test("keeps workflow browsing route-only on the landing page", () => {
    const page = readLandingFile("components/landing-page.tsx");

    expect(page).toContain("<WorkflowCard");
    expect(page).not.toContain("selectedWorkflowSlug");
    expect(page).not.toContain("selectedWorkflow");
    expect(page).not.toContain("setSelectedWorkflowSlug");
    expect(page).not.toContain("WorkflowDetail");
  });
```

- [ ] **Step 4: Add a route page test after the route-only landing test**

Insert this test immediately after `"keeps workflow browsing route-only on the landing page"`:

```ts
  test("renders static workflow detail routes from local workflow data", () => {
    const routePath = join(landingRoot, "app", "workflows", "[slug]", "page.tsx");

    expect(existsSync(routePath)).toBe(true);

    const route = readLandingFile("app/workflows/[slug]/page.tsx");

    expect(route).toContain('import Link from "next/link"');
    expect(route).toContain('import { notFound } from "next/navigation"');
    expect(route).toContain('from "../../../lib/landing-content"');
    expect(route).toContain("export function generateStaticParams()");
    expect(route).toContain("workflows.map");
    expect(route).toContain("workflows.find");
    expect(route).toContain("notFound()");
    expect(route).toContain("workflow.installCommand");
    expect(route).toContain('href="/#workflows"');
    expect(route).toContain("diagramSteps.map");
    expect(route).toContain("View source on GitHub");
    expect(route).toContain('target="_blank"');
    expect(route).toContain('rel="noreferrer"');
  });
```

- [ ] **Step 5: Run the focused test to verify red**

Run:

```bash
rtk bun test tests/landing-app.test.ts
```

Expected: FAIL. The failures should mention missing `installCommand`, missing `next/link` card import, old selected workflow state still present, and missing `landing/app/workflows/[slug]/page.tsx`.

- [ ] **Step 6: Commit the red tests**

Run:

```bash
rtk git add tests/landing-app.test.ts
rtk git commit -m "test: cover workflow detail routes"
```

Expected: commit succeeds with only `tests/landing-app.test.ts` staged.

### Task 2: Add Explicit Workflow Install Commands

**Files:**
- Modify: `landing/lib/landing-content.ts`
- Test: `tests/landing-app.test.ts`

- [ ] **Step 1: Add `installCommand` to the workflow content type**

Update `WorkflowCardContent`:

```ts
export interface WorkflowCardContent {
  slug: string;
  name: string;
  description: string;
  entrySkill: string;
  tag: string;
  accent: string;
  sourceUrl: string;
  installCommand: string;
  skills: WorkflowSkill[];
  diagramSteps: WorkflowDiagramStep[];
}
```

- [ ] **Step 2: Add install commands to every workflow object**

Add `installCommand` immediately after each `sourceUrl`.

For OpenSpec Delivery:

```ts
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/openspec-superpowers'",
```

For Release Review:

```ts
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/release-review'",
```

For Real Engineering:

```ts
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/real-engineering'",
```

For Development Design Delivery:

```ts
    installCommand:
      "npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/development-design-delivery'",
```

- [ ] **Step 3: Run the focused test**

Run:

```bash
rtk bun test tests/landing-app.test.ts
```

Expected: still FAIL. The metadata assertions should pass; failures should remain for route links, removed selected state, and missing route page.

- [ ] **Step 4: Commit the content change**

Run:

```bash
rtk git add landing/lib/landing-content.ts
rtk git commit -m "feat: add workflow install commands"
```

Expected: commit succeeds with only `landing/lib/landing-content.ts` staged.

### Task 3: Convert Workflow Cards To Route Links And Remove Landing Selection State

**Files:**
- Modify: `landing/components/workflow-card.tsx`
- Modify: `landing/components/landing-page.tsx`
- Test: `tests/landing-app.test.ts`

- [ ] **Step 1: Replace `WorkflowCard` with a link-based component**

Replace `landing/components/workflow-card.tsx` with:

```tsx
import { ArrowRight, Zap } from "lucide-react";
import Link from "next/link";
import type { WorkflowCardContent } from "../lib/landing-content";

type WorkflowCardProps = WorkflowCardContent;

export function WorkflowCard({
  slug,
  name,
  description,
  entrySkill,
  skills,
  tag,
  accent,
}: WorkflowCardProps) {
  return (
    <article className="group relative rounded-lg border border-white/10 bg-white/[0.035] p-5 transition hover:border-white/20 hover:bg-white/[0.06]">
      <span
        className={`inline-flex rounded-full border border-current/20 px-2 py-0.5 text-xs ${accent}`}
      >
        {tag}
      </span>
      <h3 className="mt-4 text-lg font-medium text-white/90">{name}</h3>
      <p className="mt-2 min-h-16 text-sm leading-6 text-white/50">{description}</p>

      <div className="mt-5 rounded-lg border border-white/10 bg-black/35 p-3">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/35">
          <Zap size={12} className="text-amber-300" />
          entry skill
        </div>
        <code className={`mt-2 block break-all font-mono text-sm ${accent}`}>${entrySkill}</code>
      </div>

      <div className="mt-5 space-y-3">
        {skills.map((skill) => (
          <div key={skill.name} className="flex gap-3">
            <div className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/25" />
            <div>
              <code className="font-mono text-xs text-white/65">{skill.name}</code>
              <p className="mt-0.5 text-xs leading-5 text-white/38">{skill.description}</p>
            </div>
          </div>
        ))}
      </div>

      <Link
        href={`/workflows/${slug}`}
        className="mt-5 inline-flex items-center gap-1.5 text-xs text-white/40 transition hover:text-white/70 focus:outline-none focus-visible:text-white focus-visible:ring-2 focus-visible:ring-violet-300/45"
      >
        View workflow
        <ArrowRight size={12} className="transition group-hover:translate-x-0.5" />
      </Link>
    </article>
  );
}
```

- [ ] **Step 2: Remove selected workflow imports and state from `LandingPage`**

In `landing/components/landing-page.tsx`, remove `useEffect` from the React import:

```tsx
import { useMemo, useState } from "react";
```

Remove this import:

```tsx
import { WorkflowDetail } from "./workflow-detail";
```

Remove these state and memo blocks:

```tsx
  const [selectedWorkflowSlug, setSelectedWorkflowSlug] = useState<string | null>(null);
```

```tsx
  const selectedWorkflow = useMemo(() => {
    if (!selectedWorkflowSlug) return null;
    return filteredWorkflows.find((workflow) => workflow.slug === selectedWorkflowSlug) ?? null;
  }, [filteredWorkflows, selectedWorkflowSlug]);
```

```tsx
  useEffect(() => {
    if (!selectedWorkflowSlug) return;
    if (filteredWorkflows.some((workflow) => workflow.slug === selectedWorkflowSlug)) return;
    setSelectedWorkflowSlug(null);
  }, [filteredWorkflows, selectedWorkflowSlug]);
```

- [ ] **Step 3: Simplify the workflow grid rendering**

Replace the selected-detail grid block with:

```tsx
        <div className="grid gap-4 md:grid-cols-2">
          {filteredWorkflows.map((workflow) => (
            <WorkflowCard key={workflow.slug} {...workflow} />
          ))}
        </div>
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
rtk bun test tests/landing-app.test.ts
```

Expected: still FAIL. Card and landing route-only assertions should pass; the remaining failure should be the missing route page.

- [ ] **Step 5: Commit the card and landing cleanup**

Run:

```bash
rtk git add landing/components/workflow-card.tsx landing/components/landing-page.tsx
rtk git commit -m "feat: link workflow cards to routes"
```

Expected: commit succeeds with only the two landing component files staged.

### Task 4: Add Static Workflow Detail Route Page

**Files:**
- Create: `landing/app/workflows/[slug]/page.tsx`
- Test: `tests/landing-app.test.ts`

- [ ] **Step 1: Create the detail route page**

Create `landing/app/workflows/[slug]/page.tsx`:

```tsx
import { ArrowLeft, ArrowRight, ExternalLink, GitBranch, Terminal, Zap } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
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
      <nav className="mx-auto flex max-w-6xl items-center justify-between px-5 py-5">
        <Link href="/#workflows" className="inline-flex items-center gap-2 text-sm text-white/55 transition hover:text-white/85">
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
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/48">
            {workflow.description}
          </p>

          <div className="mt-8 rounded-lg border border-white/10 bg-white/[0.035] p-4">
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.18em] text-white/35">
              <Terminal size={13} className="text-emerald-300" />
              install command
            </div>
            <code className="mt-3 block break-words font-mono text-sm leading-6 text-white/72">
              {workflow.installCommand}
            </code>
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
            <p className="mb-2 text-xs uppercase tracking-[0.18em] text-white/35">
              Workflow steps
            </p>
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
```

- [ ] **Step 2: Run the focused test**

Run:

```bash
rtk bun test tests/landing-app.test.ts
```

Expected: PASS.

- [ ] **Step 3: Run landing typecheck**

Run:

```bash
cd landing
rtk bun run typecheck
```

Expected: PASS. If Next's generated route types require a different `params` shape, adjust `WorkflowPageProps` to match the generated type and rerun.

- [ ] **Step 4: Commit the route page**

Run:

```bash
rtk git add landing/app/workflows/[slug]/page.tsx
rtk git commit -m "feat: add workflow detail route"
```

Expected: commit succeeds with only the new route page staged.

### Task 5: Verify, Update OpenSpec Tasks, And Preserve Evidence

**Files:**
- Modify: `openspec/changes/show-workflow-diagrams-on-landing/tasks.md`

- [ ] **Step 1: Run OpenSpec validation**

Run:

```bash
rtk openspec validate show-workflow-diagrams-on-landing --strict
```

Expected: PASS with `Change 'show-workflow-diagrams-on-landing' is valid`.

- [ ] **Step 2: Run landing build**

Run:

```bash
cd landing
rtk bun run build
```

Expected: PASS.

- [ ] **Step 3: Run the repo gate**

Run:

```bash
rtk bun run check
```

Expected: PASS.

- [ ] **Step 4: Update the OpenSpec task checklist**

In `openspec/changes/show-workflow-diagrams-on-landing/tasks.md`, mark these implementation and verification items complete:

```md
## 4. Implement With TDD

- [x] Confirm public test seams with the human owner before writing tests.
- [x] Add failing landing source-contract tests that workflow cards link to
      `/workflows/[slug]`.
- [x] Add failing tests that a route page exists for workflow details and uses
      local static workflow data.
- [x] Add failing tests that unknown slugs use `notFound()`.
- [x] Extend workflow content with any detail-page fields needed by the route.
- [x] Update `landing/components/workflow-card.tsx` to render a route link.
- [x] Add `landing/app/workflows/[slug]/page.tsx`.
- [x] Adapt `WorkflowDetail` for route-level rendering or create a focused
      route detail component.
- [x] Remove landing-page selected-workflow state if route-only detail is
      approved.
- [x] Run focused landing tests and type checks.

## 5. Verify And Archive

- [x] Run landing app typecheck and build checks.
- [x] Run `rtk bun run check`.
- [x] Smoke the landing page and detail pages in desktop and mobile viewports.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
```

- [ ] **Step 5: Record Pony Trail evidence**

Run a verification evidence pre-snapshot for the implementation files:

```bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id landing-workflow-detail-route pre --files tests/landing-app.test.ts --files landing/lib/landing-content.ts --files landing/components/workflow-card.tsx --files landing/components/landing-page.tsx --files landing/app/workflows/[slug]/page.tsx --files openspec/changes/show-workflow-diagrams-on-landing/tasks.md --action "record verification" --purpose "Preserve evidence for route-only workflow detail pages" --reason "Implementation and verification checks completed" --expected "Snapshots capture the implemented route, tests, and checklist state" --verify "Review snapshots.jsonl and session tree" --rollback "Use git revert on the implementation commits or restore files from the pre snapshot"
```

Expected: snapshot command prints JSON with `snapshot_id`, `files`, and the existing `landing-workflow-detail-route` session id.

Then run the matching post snapshot. Use the `snapshot_id` value printed by the immediately preceding pre snapshot as the value passed to `--snapshot-id`.

```bash
rtk sh /Users/roy/.agents/skills/pony-trail/scripts/snapshot_change.sh --session-id landing-workflow-detail-route post --snapshot-id "the snapshot_id printed by the previous command" --files tests/landing-app.test.ts --files landing/lib/landing-content.ts --files landing/components/workflow-card.tsx --files landing/components/landing-page.tsx --files landing/app/workflows/[slug]/page.tsx --files openspec/changes/show-workflow-diagrams-on-landing/tasks.md --summary "Implemented route-only workflow detail pages" --checks "rtk bun test tests/landing-app.test.ts; cd landing && rtk bun run typecheck; cd landing && rtk bun run build; rtk bun run check; rtk openspec validate show-workflow-diagrams-on-landing --strict" --result "pass"
```

Expected: post snapshot command prints JSON with `files` and the same `snapshot_id` used in the command.

- [ ] **Step 6: Commit verification and checklist update**

Run:

```bash
rtk git add openspec/changes/show-workflow-diagrams-on-landing/tasks.md .getsuperpower/snapshots.jsonl .getsuperpower/sessions/landing-workflow-detail-route/tree.md
rtk git commit -m "docs: record workflow detail route verification"
```

Expected: commit succeeds with verification evidence and checklist updates staged.

## Self-Review

- Spec coverage: Tasks 1-4 cover route links, local static data, route page rendering, install commands, GitHub source links, `/#workflows`, and unknown slug handling. Task 5 covers OpenSpec and verification evidence.
- Red-flag scan: no unfinished markers, vague "add tests" steps, or undefined code symbols remain.
- Type consistency: the plan consistently uses `WorkflowCardContent.installCommand`, `WorkflowCard` route links, `WorkflowPageProps`, `generateStaticParams()`, and `notFound()`.
