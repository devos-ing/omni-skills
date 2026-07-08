# Proposal: Update Landing Content For Current Workflows

## Summary

Refresh the GetSuperpower landing-page content so it matches the current CLI,
workflow manifests, and install flow.

The page already has the right registry-style shape and the current Startup
Team role catalog. This change keeps that visual system and updates the
copy/data model around it: alias-first installs, current role workflow examples,
loop-enabled workflow language, automatic dependency bootstrap, global workflow
records, and the live root command surface.

## Motivation

The repository has moved since the landing copy was written. Current docs and
CLI help now teach alias installs such as `install openspec-superpowers`, list
`lock`, `remove`, `onboard`, and `loop` as live commands, document global
workflow records under `~/.getsuperpower/workflows/`, and include a
loop-enabled `grilled-product-dev` example.

The landing page already leads with the newer Startup Team role catalog, but its
install section still describes local workflow records and its command selector
does not expose the latest inspection, lock, remove, and loop commands. That
makes the first public product surface feel older than the code and README.

## Scope

In scope:

- Preserve the current startup role workflow registry: `startup-team`, `ceo`,
  `cto`, `product-manager`, `engineering-manager`, `founding-engineer`, and
  `qa-lead`.
- Update `landing/lib/landing-content.ts` command examples to match current
  workflow manifests and README guidance.
- Prefer alias install commands for checked-in examples while keeping source
  links to GitHub.
- Update explanatory copy in `landing/components/landing-page.tsx` and related
  local content to mention dependency bootstrap, home-global workflow records,
  loop-enabled workflows, lock files, removal, and current commands.
- Keep the current registry layout, route-backed detail pages, copyable install
  commands, GitHub stars, agent badges, and workflow-run demo.
- Add or update source-contract tests for the refreshed content.
- Run focused landing tests and the repo verification gate where possible.

Out of scope:

- Changing GetSuperpower CLI behavior.
- Redesigning the landing page layout.
- Adding live registry telemetry, activity metrics, ranks, or install counts.
- Reintroducing paused Pony Trail history, revert, or prehook features as
  public CLI capabilities.
- Fixing unrelated loop-runtime merge conflicts already present in the working
  tree.
- Publishing or deploying the landing app.

## Current Source Findings

- `README.md` teaches alias installs for `startup-team` and the individual
  startup role workflows.
- `docs/architecture.md` lists current commands including `lock`, `remove`,
  `loop`, `skills install`, and `skills update`.
- `examples/workflows/grilled-product-dev/workflow.json` declares a
  loop-enabled, action-only workflow with one `entry: true` local skill.
- `docs/workflow-author-guide.md` documents the generated loop runner contract:
  installed entry skills receive generated `loop.mjs` and
  `loop.metadata.json`; agents should use `getsuperpower loop ...`.
- The current landing content already uses the startup role catalog, but its
  common command examples and install behavior copy trail the current CLI.
- Existing source-contract tests already guard against fake workflow telemetry;
  that should stay true.

## Proposed Content Direction

Keep the first-screen message:

1. GetSuperpower packages a whole AI-agent workflow as one callable skill.
2. Users install by alias, path, or public git URL.
3. The install flow validates manifests, fetches missing external skills through
   the Skills CLI metadata, and records installed workflows globally by default.
4. Some workflows can opt into resumable action-only loops through the
   `getsuperpower loop` command.
5. The registry shows the current startup role catalog, without placeholder
   activity or install metrics.

## Acceptance Criteria

- Landing command examples include alias-first startup role installs and current
  inspection, lock, loop, list, remove, init, and validate commands.
- Landing copy mentions global workflow records under
  `~/.getsuperpower/workflows/` rather than only local `.getsuperpower/`.
- Landing copy mentions current dependency bootstrap behavior without implying
  deterministic live agent execution in the browser.
- Landing copy or command examples expose the current `loop` command surface
  through the loop-enabled `grilled-product-dev` example.
- The workflow registry preserves the current startup role catalog and does not
  replace it with older compatibility examples.
- Existing workflow detail routes continue to render install commands and source
  links from local landing content.
- The landing page still does not show fake activity, rank, or install-count
  data.
- Source-contract tests cover the new current-workflow content.
- `rtk bun test tests/landing-app.test.ts` passes.
- `rtk bun run check` is attempted before delivery; any failure from the
  pre-existing unmerged loop-runtime files is reported separately.
