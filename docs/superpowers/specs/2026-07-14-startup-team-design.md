# Startup Team Manifest and Catalog Design

**Status:** Approved for implementation planning  
**Date:** 2026-07-14

## Summary

Introduce `team` as a first-class Omniskills manifest kind and move the existing
startup role bundle from `examples/workflows/startup-goal` to
`examples/teams/startup-team`.

Users install the package with:

```bash
npx omniskill@latest install startup-team
```

The installed team's callable coordinator remains `$startup-goal`. The old
`startup-goal` installation alias is removed rather than redirected.

## Problem

The current `startup-goal` bundle is presented and stored as one workflow even
though its durable product concept is a coordinated team: one coordinator,
seven operating roles, and several companion skills. This makes the public
package name, repository layout, and manifest model less precise than the
behavior users receive.

Omniskills also has no structural way to distinguish a team roster from a
normal workflow dependency list. Consumers must infer the coordinator and
members from skill names and ordered steps.

## Goals

- Add a first-class `team` manifest kind without breaking existing workflow
  manifests.
- Represent one coordinator and a unique roster of local member skills.
- Publish the startup bundle as `startup-team` under `examples/teams/`.
- Keep `$startup-goal` as the entry skill that interviews, routes, dispatches,
  and combines role outputs.
- Update all public landing, documentation, command, demo-source, and test
  surfaces to the new package identity.
- Preserve the existing role set, companion dependencies, approval gates, and
  execution steps.

## Non-goals

- A team does not contain or compose multiple workflow manifests.
- A team does not introduce a second execution engine.
- The role skills, routing policy, approval gates, and implementation handoff
  are not redesigned.
- No `startup-goal` install alias or automatic migration is provided.
- Existing internal `WorkflowBundle` names are not broadly renamed solely for
  terminology consistency.
- This change does not publish a package release or remove an old installed
  record from a user's machine.

## User-facing contract

| Concern | Contract |
| --- | --- |
| Package name | `startup-team` |
| Repository path | `examples/teams/startup-team` |
| Install | `npx omniskill@latest install startup-team` |
| Dependencies | `npx omniskill@latest deps startup-team` |
| Remove new install | `npx omniskill@latest remove startup-team` |
| Callable coordinator | `$startup-goal` |
| Source URL | `.../tree/main/examples/teams/startup-team` |
| Old install alias | Unsupported; no redirect |

An already-installed local record named `startup-goal` remains removable with
`omniskill remove startup-goal`. This is cleanup of local state, not an alias
for fetching or installing the renamed package. Installing `startup-team` does
not silently remove or migrate that old record.

## Manifest model

### Shared manifest kinds

The existing `workflow.json` filename remains the bundle entrypoint for both
kinds. The schema accepts:

- `kind: "workflow"` for an explicitly classified workflow.
- an omitted `kind` for legacy workflow behavior.
- `kind: "team"` for a team with `coordinator` and `members`.

Existing manifests therefore continue to validate without a mass migration.
The runtime treats an omitted kind as `workflow` when choosing behavior and
display labels.

### Startup Team manifest shape

The migrated bundle has this structural shape, with the existing full
`skills[]` and `steps[]` retained:

```json
{
  "schemaVersion": "0.1",
  "kind": "team",
  "name": "startup-team",
  "version": "0.2.0",
  "coordinator": "./skills/startup-goal",
  "members": [
    "./skills/ceo",
    "./skills/cto",
    "./skills/product-manager",
    "./skills/web-design",
    "./skills/engineering-manager",
    "./skills/founding-engineer",
    "./skills/qa-lead"
  ],
  "skills": [],
  "steps": []
}
```

`0.2.0` marks the breaking package identity and manifest-model change while
preserving the history of the existing pre-1.0 bundle.

### Validation rules

For `kind: "team"`:

1. `coordinator` is required.
2. `members` is required and contains at least one item.
3. `coordinator` exactly matches one declared `skills[].source` value.
4. Every member exactly matches one declared `skills[].source` value.
5. Coordinator and members must be local skill sources.
6. Member values are unique.
7. The coordinator cannot also be a member.
8. Companion and implementation skills remain ordinary `skills[]`
   dependencies and are not members.
9. Existing step validation remains unchanged: each `steps[].skill` must match
   a declared skill source.

The schema rejects `coordinator` or `members` on an explicit workflow manifest
so team metadata cannot be silently ignored.

The seven member roles are CEO, CTO, product manager, web design, engineering
manager, founding engineer, and QA lead. External design, planning, testing,
review, and implementation skills remain dependencies only.

## Catalog and alias resolution

Bare aliases ending in `-team` resolve to:

```text
examples/teams/<alias>
```

Other bare aliases continue to resolve to:

```text
examples/workflows/<alias>
```

This makes the team catalog reusable without a one-off `startup-team` branch in
the resolver. The loaded manifest remains authoritative: a bundle resolved
from `examples/teams/` must validate as `kind: "team"`. A team manifest loaded
from a direct local path or full git URL is valid regardless of the source
folder because the manifest, not the path, defines its type.

After the move, the bare alias `startup-goal` resolves to the now-missing
`examples/workflows/startup-goal` path and returns the existing alias-not-found
error. It is not redirected to `startup-team`.

## Runtime flow

```text
install startup-team
  -> classify the bare alias as a team catalog alias
  -> clone examples/teams/startup-team
  -> parse workflow.json
  -> validate kind, coordinator, members, skills, and steps
  -> validate workflow.lock.json
  -> install coordinator, member, and companion skills
  -> write an installed record retaining team metadata
  -> tell the user to invoke $startup-goal
```

The existing skill installer remains the single installation seam. Team
metadata changes validation, catalog resolution, display copy, and installed
records; it does not create a separate target-writing implementation.

## Components and boundaries

### Manifest runtime

`src/runtimes/omniskill/workflow-bundles.ts` owns the discriminated manifest
schema, cross-field validation, effective bundle kind, catalog alias path, lock
creation, and installed-record persistence.

Small display helpers may expose `workflow` versus `team` terminology to
`src/omniskill.ts` and CLI result formatting. The CLI must not duplicate schema
or roster rules.

The paused runtime under `src/runtimes/ponytrail/` is not an active public
surface. It should only be updated if compilation or active tests demonstrate
that its duplicated types must stay aligned.

### Example bundle

Move the full directory, including README, local skills, manifest, and lock:

```text
examples/workflows/startup-goal
  -> examples/teams/startup-team
```

The local entry-skill folder and frontmatter name remain
`skills/startup-goal/SKILL.md` and `name: startup-goal`. The manifest name,
description, version, kind, coordinator, members, and regenerated lock identity
use `startup-team`.

### Public content

Update these content categories together:

- root README installation and role-catalog examples;
- workflow author guide paths and commands;
- English and Traditional Chinese landing-content documents;
- landing catalog data, command rails, source links, hero copy, flow diagram,
  and simulated workbench labels;
- source-contract tests for README and landing content.

Package references become `Startup Team`, `startup-team`, and
`examples/teams/startup-team`. Coordinator invocation examples remain
`$startup-goal` or `/startup-goal`. Mechanical global replacement is unsafe
because the package name and coordinator name intentionally differ.

## Error handling

Validation errors identify the invalid field and source:

- a team without a coordinator;
- a team without members;
- an undeclared or non-local coordinator;
- an undeclared, non-local, or duplicate member;
- a coordinator repeated in members;
- team-only fields on an explicit workflow manifest;
- a `-team` alias whose resolved manifest is not `kind: "team"`.

Fetch and missing-alias errors retain the current cleanup behavior for temporary
clones. Validation failure must not leave a partially written installed record.

## Testing strategy

### Schema and runtime tests

- Legacy manifests without `kind` still load as workflows.
- Explicit `kind: "workflow"` loads without team fields.
- A valid team retains coordinator and members in its installed record.
- Each team validation rule has a focused failure test.
- A `-team` alias resolves under `examples/teams/`.
- A non-team alias still resolves under `examples/workflows/`.
- A catalog/path kind mismatch fails clearly.
- `startup-goal` is not treated as an alias for `startup-team`.

### Bundle contract tests

- Load `examples/teams/startup-team`.
- Assert manifest identity, kind, coordinator, exact members, skills, steps,
  approval gates, and regenerated lock identity.
- Preserve the existing coordinator and role-skill behavioral assertions.

### Public surface tests

- Require `startup-team` install, dependency, remove, and source commands.
- Reject stale `install startup-goal` commands and old source paths.
- Require `$startup-goal` coordinator examples to remain present.
- Require English and Traditional Chinese catalog content to agree.

## Verification

Implementation is complete only after this ladder passes:

```bash
rtk bun test tests/workflow-bundles.test.ts
rtk bun test tests/readme.test.ts tests/landing-app.test.ts
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- deps examples/teams/startup-team
rtk bun run dev -- --help
rtk bun run check
```

A local smoke test should also exercise the `startup-team` alias through the
existing injectable git runner so it does not depend on live network access.

## Acceptance criteria

- `examples/teams/startup-team/workflow.json` is a valid team manifest.
- Its coordinator is `./skills/startup-goal` and its members are exactly the
  seven approved local roles.
- `npx omniskill@latest install startup-team` resolves to the team catalog.
- No install compatibility alias exists for `startup-goal`.
- `$startup-goal` remains the installed callable entry skill.
- Installed team records preserve `kind`, `coordinator`, and `members`.
- Landing and documentation surfaces consistently distinguish the Startup Team
  package from the startup-goal coordinator.
- Focused tests, smoke checks, and the full repository gate pass.

## Risks and rollback

- **Package/coordinator confusion:** Guard public strings with source-contract
  tests that require `startup-team` commands and `$startup-goal` invocation.
- **Alias convention collision:** Reserve the `-team` suffix for manifests of
  `kind: "team"` and validate the resolved kind.
- **Stale installed records:** Document manual removal; do not mutate user state
  during install.
- **Wide content drift:** Update English, Traditional Chinese, landing code,
  demos, and tests as one implementation slice.

Rollback is a single scoped revert: restore the bundle to
`examples/workflows/startup-goal`, remove team-only schema and alias resolution,
restore the old public content, and regenerate the original lock file.

## Approval gates

1. Design approval: complete.
2. Written-spec review: user reviews this file before planning begins.
3. Implementation-plan approval: required before role dispatch or code changes.
4. Startup-team route approval: required before selected role subagents execute.
5. Completion: requires verification evidence from the full repository gate.

## Clean-install amendment

The approved design originally retained the bare `implement` dependency and
step exactly. An isolated install into a clean home later proved that a fresh
user could install the first 24 dependencies but could not resolve bare
`implement`.

The implemented team therefore declares `mattpocock:implement` with the pinned
`https://github.com/mattpocock/skills/tree/v1.1.0` repository and uses that
exact source in the implementation step. The installed skill name and behavior
remain `implement`; the amendment only makes its package source explicit. All
coordinator, member, approval-gate, and execution-order contracts remain
unchanged.
