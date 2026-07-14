# Team Members as Canonical Child Workflows

## Goal

Prevent team bundles from copying role `SKILL.md` files that already belong to
standalone workflows. A team should own its coordinator and composition, while
each standalone role workflow owns its role instructions and companion skills.

`startup-team` remains the public package and the only installed workflow
record. Its callable coordinator remains `$startup-goal`.

## Current Problem

`examples/teams/startup-team/skills/` currently contains local copies of CEO,
CTO, product manager, web-design, engineering manager, founding engineer, and
QA lead skills. Equivalent standalone workflows exist under
`examples/workflows/`. The copies differ and can drift because both locations
can be edited independently.

The current team validator reinforces this duplication by requiring every
`members[]` value to be a declared local skill path.

## Ownership Model

- The team owns `skills/startup-goal/SKILL.md`, its unique coordinator.
- Standalone role workflows own their entry skills and companion dependencies.
- A team member is a child workflow reference, not a copied local role skill.
- Installing a team expands child workflows into leaf skills but writes only
  the root team install record.

The standalone role workflow is authoritative. Team-specific copies are not
generated or synchronized.

## Manifest Contract

`startup-team` uses the existing string source format:

```json
{
  "coordinator": "./skills/startup-goal",
  "members": [
    "catalog:ceo",
    "catalog:cto",
    "catalog:product-manager",
    "catalog:web-design",
    "catalog:engineering-manager",
    "catalog:founding-engineer",
    "catalog:qa-lead"
  ]
}
```

Every coordinator and member source must also appear in `skills[]`. Steps refer
to the same declared source strings. The team manifest no longer repeats the
child workflows' companion skills.

The coordinator remains a declared local skill and the root entry skill. A
member may use any supported child-workflow source form—local workflow path,
repository/subdirectory, `catalog:`, or `installed:`—provided resolution proves
that it is a workflow.

The manifest schema remains `0.1` because the JSON field shapes do not change.
Team validation semantics intentionally become stricter: local role skills are
no longer valid members.

## Resolved Team Validation

Synchronous manifest parsing continues to validate required fields, declared
source references, duplicate source strings, and coordinator/member separation.
Checks that require loading a child source run after dependency resolution.

For each team member, the runtime must prove that:

1. The declared source resolves to a child workflow.
2. The selected child workflow declares exactly one `entry: true` skill.
3. The entry skill is a local skill path within that child workflow.
4. The resolved workflow name is unique within the team.
5. The resolved entry skill name is unique within the team.

The existing highest-SemVer child-workflow selection and cycle detection apply
before these checks. `validate`, `deps`, `lock`, and `install` must use the same
resolved-team validation function so their answers cannot diverge.

Validation fails before target writes. Errors identify the member source and
the violated rule, including:

- member did not resolve to a workflow;
- member workflow has no entry skill;
- member workflow has multiple entry skills;
- member entry skill is not local;
- duplicate resolved workflow or entry-skill name; or
- dependency cycle.

## Resolution and Installation Flow

1. Load and parse the root team manifest.
2. Resolve the recursive workflow dependency graph.
3. Select the highest workflow version for every logical child workflow.
4. Validate the root coordinator and resolved team-member entry skills.
5. Flatten the selected child workflows into deduplicated leaf skill installs.
6. Validate or generate the expanded lock graph.
7. Install the coordinator, member entry skills, and companion leaf skills.
8. Write one `startup-team` install record containing the resulting artifacts.

Child workflow records are not registered separately. Installed callable names
remain `$startup-goal`, `$ceo`, `$cto`, `$product-manager`, `$web-design`,
`$engineering-manager`, `$founding-engineer`, and `$qa-lead`.

## Lock Contract

The schema `0.2` lock records the root team, child workflow nodes, workflow
edges, exact repository commits, and leaf fingerprints. Regenerating the
`startup-team` lock must capture the canonical standalone role entry skills and
their companion dependencies. Deleted team-local role paths must not remain in
the lock.

## Repository Migration

1. Keep `examples/teams/startup-team/skills/startup-goal/SKILL.md`.
2. Delete the seven duplicated team-member skill directories.
3. Replace team member and step sources with `catalog:<role>` references.
4. Remove companion skills now supplied transitively by child workflows.
5. Regenerate `examples/teams/startup-team/workflow.lock.json`.
6. Update architecture, authoring, README, landing, and source-link content.
7. Make landing role links target the canonical standalone workflow skills.

Existing team manifests with local skill members fail validation with migration
guidance to reference a child workflow. The public install command and package
name remain unchanged.

## Verification

Focused tests must prove:

- local skill members are rejected;
- all supported child-workflow source forms can provide team members;
- zero-entry, multi-entry, non-local-entry, duplicate, and cyclic members fail;
- highest-version workflow selection determines the member entry skill;
- `validate`, `deps`, `lock`, and `install` enforce the same contract;
- each role entry skill installs exactly once;
- companion skills arrive transitively;
- graph failure causes no target writes;
- only the `startup-team` record is written; and
- landing/docs link to canonical standalone role sources.

Run a clean-home `startup-team` install smoke, the relevant CLI smokes, and
`rtk bun run check`. The repository's 90% line-coverage gate remains required.

## Non-Goals

- Registering child workflows as separately installed workflows.
- Moving or rewording the canonical standalone role skills.
- Generating synchronized team-local copies.
- Replacing the team-specific `startup-goal` coordinator.
- Changing role dispatch, approval gates, or runtime subagent behavior.
- Expanding repository URL version parsing beyond the existing dependency
  resolution contract.
