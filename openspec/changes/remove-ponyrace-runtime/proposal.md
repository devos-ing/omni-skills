# Remove Ponyrace Runtime And Focus On GetSuperpower Bundles

## Summary

Refocus this repository on GetSuperpower bundle-skill authoring, validation,
installation, and dependency bootstrapping. Remove the older Ponyrace
requirement-court runtime, worker-backed pony discussion flow, onboarding/setup
flow, and docs that position `/ponyrace` as a product primitive.

## Problem

The repository now has two product centers:

- GetSuperpower bundle skills: workflow manifests, entry skills, dependency
  installation, author guides, and examples.
- Ponyrace requirement review: bots, goals, votes, local/worker pony runners,
  approval reports, onboarding/setup, and `/ponyrace` commands.

The second surface makes the project harder to understand and keeps tests,
docs, and runtime modules centered on a direction we no longer want. Users
should see one idea: install or author a GetSuperpower that bundles skills.

## Proposed Direction

Keep the bundle-skill product and remove Ponyrace-specific review code.

### Keep

- `getsuperpower` commands:
  - `getsuperpower init`
  - `getsuperpower validate`
  - `getsuperpower install`
  - `getsuperpower list`
  - `getsuperpower deps`
- `skills install` and `skills update`, including external package support such
  as `ponyrace skills install mattpocock/skills`.
- Workflow bundle loading, validation, scaffolding, install records, and example
  workflows.
- The GetSuperpower authoring skill and bundled workflow examples.
- Snapshot/history internals only where they support skill or bundle install
  evidence.

### Remove

- The `/ponyrace` CLI command and lower-level requirement review primitive.
- `stream-goal`, `goal`, `vote`, `bots`, `setup`, and `onboard` commands if they
  exist only to support Ponyrace requirement review.
- Requirement-court runtime modules: goal drafting, brainstorming, voting,
  requirement reports, HTML/Markdown approval reports, and role pony execution.
- Worker CLI pony adapters and local pony runners that exist only for review
  discussion.
- Bundled Ponyrace review skills and requirement-court role skills.
- README and docs sections that teach Ponyrace as the primary product.

## Design Notes

- Prefer a small public CLI centered on GetSuperpower and skill installation.
- Move or rename surviving runtime code away from `ponytrail` if it remains
  bundle-specific after the cut.
- Keep compatibility aliases only if they help existing bundle users:
  `bundle` and `workflow` may remain as aliases for one transition period, but
  `/ponyrace` should not.
- Do not delete local audit/snapshot machinery if the CLI still records
  install evidence through it.
- Tests should verify public commands and behavior, not the removed module
  structure.

## Out Of Scope

- Publishing a new npm package name.
- Renaming the repository.
- Implementing automatic workflow step execution.
- Changing third-party Skills CLI behavior.

## Human Approval Gate

Before implementation, confirm these two decisions:

1. Should the npm package and binary remain `ponyrace` for now while the product
   surface becomes GetSuperpower-only?
2. Should `bundle` and `workflow` stay as compatibility aliases, or should the
   first cleanup remove them too?
