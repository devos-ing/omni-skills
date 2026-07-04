# Workflow Detail Routes Design

## Goal

Make the landing page's "View workflow" action navigate to a dedicated workflow
detail page instead of opening an in-page selected-workflow panel.

## Approved Decisions

- Detail route shape: `/workflows/[slug]`.
- Detail placement: route-only. The landing page should not keep a compact
  selected-workflow preview after cards become links.
- Back link target: `/#workflows`.
- Data source: local static workflow content in `landing/lib/landing-content.ts`.
- Runtime scope: no CLI, registry, GitHub fetch, or generated `.getsuperpower/`
  reads.

## Architecture

The landing app stays an isolated Next.js App Router application under
`landing/`. Workflow browsing remains on the root landing page, while workflow
inspection moves to a static dynamic route:

```text
landing/
  app/
    page.tsx
    workflows/
      [slug]/
        page.tsx
  components/
    landing-page.tsx
    workflow-card.tsx
    workflow-detail.tsx
  lib/
    landing-content.ts
```

`landing/lib/landing-content.ts` remains the single local content source for
workflow slugs, names, descriptions, entry skills, source URLs, and ordered
diagram steps. The route page uses that content to generate static params and
to resolve one workflow by slug.

## Component Design

`WorkflowCard` should become link-based. It should accept enough workflow data
to build a route URL from `/workflows/${slug}` and render the visible "View
workflow" action as a Next `Link`. The card no longer needs `isSelected` or
`onViewWorkflow`.

`LandingPage` should remain the owner of search, command tabs, hero content,
and the workflow card grid. It should remove `selectedWorkflowSlug`,
`selectedWorkflow`, the selected-workflow cleanup effect, and the side-panel
layout branch.

`landing/app/workflows/[slug]/page.tsx` should render the dedicated detail
route. It should:

- export `generateStaticParams()` from the local workflow list;
- find the matching workflow by `params.slug`;
- call `notFound()` when no workflow exists for the slug;
- render a page-level detail experience using the current dark technical visual
  language;
- include the workflow name, description, tag, callable entry skill, install
  command, ordered steps, GitHub source link, and `Back to workflows` link.

The existing `WorkflowDetail` component can either be adapted into a route-level
component or wrapped by the route page. If adapting it would make the old
side-panel naming misleading, create a focused route component and keep the
route page thin.

## Data Flow

The root landing page maps `filteredWorkflows` to cards. Each card computes its
own route URL from `workflow.slug`.

The detail route receives the URL slug from Next, resolves it against the same
`workflows` array, and renders static content. No client state is needed for
detail selection.

The install command can be derived from the workflow source URL:

```text
npx getsuperpower@latest install '<git-source>'
```

If deriving from `sourceUrl` makes the conversion from GitHub tree URL to git
fragment awkward, add an explicit `installCommand` field to
`WorkflowCardContent`. Prefer explicit local data over clever URL rewriting.

## Error Handling

Unknown slugs should call Next's `notFound()` from the route page. The page must
not render an empty detail state or fall back to the first workflow, because
that would make shared URLs misleading.

Search filtering on the landing page should not need special stale-state logic
after selected workflow state is removed. A filtered card still links to its own
stable route.

## Testing

Use focused Bun source-contract tests in `tests/landing-app.test.ts`, matching
the existing landing test style.

Cover these public seams:

- `WorkflowCard` imports `Link` from `next/link` and renders
  `/workflows/${slug}`;
- `LandingPage` no longer owns `selectedWorkflowSlug` or renders
  `WorkflowDetail` as an in-page side panel;
- `landing/app/workflows/[slug]/page.tsx` exists;
- the route page exports `generateStaticParams`;
- the route page calls `notFound()` for unknown slugs;
- the route page reads from local `workflows`;
- the detail page includes the entry skill, ordered steps, install command,
  GitHub source link, and `/#workflows` back link.

Final verification should run:

```bash
rtk bun test tests/landing-app.test.ts
rtk openspec validate show-workflow-diagrams-on-landing --strict
rtk bun run check
```

For landing runtime checks, also run from `landing/`:

```bash
rtk bun run typecheck
rtk bun run build
```

## Risks

The main risk is duplicating detail UI between the old side panel and the new
route page. The mitigation is route-only detail: remove selected workflow state
from the landing page and let the route own the detailed view.

The second risk is over-building the detail route into a registry surface. The
mitigation is to keep the v1 static and local, using the existing workflow
content model.

The third risk is command drift. The mitigation is to store or derive install
commands from the same content file tested by the landing source-contract suite.

## Self-Review

- Completeness scan: no unfinished markers or incomplete sections remain.
- Consistency check: the design matches the approved `/workflows/[slug]`
  route-only direction and the OpenSpec proposal.
- Scope check: this is a landing app routing and rendering change, not a CLI,
  registry, deployment, or workflow-bundle runtime change.
- Ambiguity check: URL shape, data source, error handling, back link, component
  ownership, and verification commands are explicit.
