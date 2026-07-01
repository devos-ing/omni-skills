# Proposal: GetSuperpower Install/Clone Bundle Skill Sets

## Summary

Make the public GetSuperpower command language center on deployable bundle skill
sets:

```bash
getsuperpower install <bundle-skills-set-name-or-source>
getsuperpower clone <bundle-skills-set-name-or-source>
```

`install` stays the stable existing command. `clone` becomes the friendly command
for people discovering, copying, or deploying a workflow bundle skills set from a
built-in name, local path, or shareable source. Both verbs install the same
skills and record the same workflow metadata.

## Motivation

The project is now focused on GetSuperpower bundle skills rather than the older
Ponyrace requirement-review runtime. The command vocabulary should make that
product boundary obvious:

- A GetSuperpower is a bundle skills set / workflow.
- Anyone can author and deploy their own bundle skills set.
- Users should not need to learn legacy `workflow` or `bundle` commands first.
- `clone` should feel natural when the bundle comes from another person or repo.

## Scope

In scope:

- Add `getsuperpower clone <source>` as a first-class command or documented alias
  of `getsuperpower install <source>`.
- Update help, README, examples, author guide, and tests to teach
  `getsuperpower install/clone <bundle skills set name>`.
- Keep `getsuperpower install` compatible.
- Keep `bundle` and `workflow` compatibility aliases only as transitional
  backwards-compatible surfaces.
- Preserve automatic dependency installation for external skill packages such as
  `mattpocock:*`.

Out of scope:

- A hosted registry service.
- Fully automatic publication to GitHub/npm.
- Removing the existing package/binary name in this change.
- Reintroducing Ponyrace requirement-review runtime commands.

## Proposed Command Model

| Command | Meaning |
| --- | --- |
| `getsuperpower install product-dev` | Install a bundled first-party workflow by name. |
| `getsuperpower clone product-dev` | Same behavior, friendlier verb for copying/deploying a bundle skills set. |
| `getsuperpower install ./my-workflow` | Install a local author-created bundle. |
| `getsuperpower clone ./my-workflow` | Same behavior for a local/shared bundle source. |
| `getsuperpower deps <source>` | Inspect bundle skill dependencies before install/clone. |
| `getsuperpower init <name>` | Create an authorable bundle skills set. |
| `getsuperpower validate <source>` | Validate a bundle skills set before sharing. |

## Approved Decisions

- `clone` has the same behavior as `install`; it is an alternate public verb,
  not a separate local-copy operation.
- The public phrase is **GetSuperpower**. Supporting copy may explain that a
  GetSuperpower is a deployable bundle skills set / workflow, but command docs
  should lead with GetSuperpower.

## Acceptance Criteria

- `getsuperpower clone <source>` installs the same skills and workflow record as
  `getsuperpower install <source>`.
- CLI help presents `install` and `clone` under `getsuperpower`.
- Documentation describes GetSuperpower as a deployable "bundle skills set
  (workflow)" that any author can create and share.
- Existing `getsuperpower install`, `bundle`, and `workflow` tests continue to
  pass.
- `rtk bun run check` passes.

## Closed Questions

- `clone` output can reuse the existing install result copy because clone and
  install are the same operation.
- Docs should use **GetSuperpower** as the main public phrase.
