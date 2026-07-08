# Proposal: Refresh README For Startup Superpowers

## Summary

Rewrite the project README around the current GetSuperpower story:

- "Power your ability" with installable workflow skill trees.
- Start a company with a bundle of startup roles: CEO, CTO, Product Manager,
  Engineering Manager, Founding Engineer, and QA Lead.
- Run the startup bundle toward a goal and keep looping until the goal is done.
- Free up complex workloads by packaging orchestration into one callable skill
  instead of asking users to manually call each role or process skill.
- Show that built-in workflows compose Matt Pocock skills, Superpowers,
  Ponytrail evidence, and more skills coming over time.

The README should remove the old architecture diagrams as the main visual
material and instead use the provided landing-registry screenshot as the new
product image.

## Motivation

The current README still reads like a technical bundle explainer. It explains
`workflow.json`, shows old diagram assets, and lists many examples, but it does
not make the new product promise obvious enough: install a GetSuperpower, give
it a goal, and let the right startup roles and process skills move the work
forward.

The screenshot the user provided shows the current landing registry clearly:
Startup Team first, then individual role workflows. That image should replace
the older generic diagrams as the README's visual anchor.

## Scope

In scope:

- Rewrite `README.md` with a sharper product-led structure.
- Use the provided screenshot as README material, copied into a stable repo
  asset path.
- Remove README references to the old diagram assets as primary content.
- Keep the real public command style: `npx getsuperpower@latest ...`.
- Lead with `npx getsuperpower@latest install startup-team`.
- Include a goal/loop example for startup-team or a loop-capable workflow using
  the current `getsuperpower loop` command surface.
- Explain that GetSuperpower bundles compose Matt Pocock skills, Superpowers,
  Ponytrail evidence, and future skill packs.
- Keep startup role aliases visible: `ceo`, `cto`, `product-manager`,
  `engineering-manager`, `founding-engineer`, and `qa-lead`.
- Keep practical command references for install, list, deps, lock, loop,
  remove, init, validate, and skills install/update.
- Add or update focused tests/contract checks for README copy and asset
  references.
- Run README-focused tests plus the repo verification gate before delivery.

Out of scope:

- Changing CLI behavior.
- Changing workflow manifests or skill implementations.
- Redesigning the landing app.
- Adding live workflow telemetry or fake install/activity metrics.
- Publishing a release or opening a PR unless separately requested.

## Proposed README Shape

1. Hero image from the provided startup role registry screenshot.
2. Title and headline:
   - `# GetSuperpower`
   - `Power your ability.`
3. Short product promise:
   - Install a workflow skill tree.
   - Call one entry skill.
   - Let startup roles and process skills carry complex work forward.
4. Quick start:
   - `npx getsuperpower@latest install startup-team`
   - example invocation for `$startup-team`
5. Goal loop:
   - show `getsuperpower loop start ...`
   - explain action-only resumable loops that continue until the goal is done.
6. Built-in startup roles:
   - Startup Team, CEO, CTO, Product Manager, Engineering Manager, Founding
     Engineer, QA Lead.
7. Skill ecosystem:
   - Matt Pocock skills
   - Superpowers
   - Ponytrail evidence
   - more workflow packs coming.
8. Command reference and local development.

## Acceptance Criteria

- `README.md` starts with the new product positioning around "Power your
  ability."
- `README.md` shows `npx getsuperpower@latest install startup-team` near the
  top.
- `README.md` describes starting a company with startup role workflows.
- `README.md` explains goal loops as action-only, resumable workflow state that
  can continue until done.
- `README.md` mentions Matt Pocock skills, Superpowers, Ponytrail evidence, and
  future workflow packs.
- `README.md` uses the provided screenshot from a repo-local asset path.
- `README.md` no longer embeds the old `getsuperpower-how-it-works.svg` or
  `getsuperpower-install-sequence.svg` diagrams as primary visuals.
- README tests or source-contract checks cover the new positioning and image
  reference.
- Existing landing and workflow tests still pass.
