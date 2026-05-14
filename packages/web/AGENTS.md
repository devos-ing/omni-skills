# devos.ing Web Agent Instructions

The web package owns the Next.js operator UI. Build useful monitoring and
control surfaces directly, and keep UI behavior aligned with the repository's
server/API contracts.

## Ownership Rules

1. Keep web UI code under `packages/web/src/`.
2. Use the existing React Query and provider plumbing for client-side data
   fetching and app-level state.
3. Keep API access isolated in web library/client modules instead of scattering
   fetch logic through components.
4. Keep reusable UI behavior in components and helpers that match the existing
   Next.js, TypeScript, and Tailwind setup.
5. Do not move workflow orchestration, CLI execution, or integration logic into
   the web package.

## Frontend Quality

1. Build the usable operator experience as the first screen; do not add a
   marketing-style landing page unless explicitly requested.
2. Keep layouts responsive and verify that text and controls do not overlap on
   mobile or desktop viewports.
3. Avoid visible in-app text that explains implementation details, keyboard
   shortcuts, or styling mechanics.
4. Use feature-complete controls for expected workflows, and prefer concise,
   scan-friendly operational UI over decorative presentation.
5. After meaningful visible UI changes, run the web app locally and verify it in
   a browser.

## Tests And Checks

1. Add tests for new UI data contracts or behavior when a test harness exists.
2. Otherwise, run the relevant package checks for visible or data-flow changes:
   - `bun run --filter web typecheck`
   - `bun run --filter web build`
3. For repo-wide changes, still run the root quality gates from the root
   `AGENTS.md`.

## Workflow Checkpoints

- Before implementation edits, re-state the scoped plan and confirm the web
  modules expected to change.
- After implementation edits and before validation, summarize changed UI or
  data-flow behavior and any tests added or updated.
- After checks run, report pass/fail/blocker status, skipped commands, and
  remaining risk.
