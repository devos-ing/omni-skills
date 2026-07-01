# Proposal: Remove GetSuperpower Command Folder

## Summary

Fold the separate `getsuperpower-command/` package-shaped folder back into the
main GetSuperpower source tree. The project is now itself `getsuperpower`, so
the command registration module should live under `src/` instead of a side
package boundary.

## Motivation

The earlier root-level command package made sense while GetSuperpower was being
introduced inside the old Ponyrace project. After the public package and binary
rename, that extra folder is confusing: it suggests GetSuperpower is still a
dependency of the project instead of the project itself.

## Scope

In scope:

- Move the command module into `src/getsuperpower.ts`.
- Update `src/cli.ts` and tests to import from the new source module.
- Remove `getsuperpower-command/index.ts` and `getsuperpower-command/package.json`.
- Update docs and AGENTS guidance that still describes the old folder.
- Preserve root `getsuperpower install/clone/deps/init/validate/list` behavior.
- Preserve compatibility aliases.

Out of scope:

- Migrating existing legacy local state directories; current runtime state lives
  under `.getsuperpower/`.
- Renaming `pony-trail`.
- Renaming the internal `src/runtimes/ponytrail/` folder.

## Acceptance Criteria

- No `getsuperpower-command/` folder remains.
- `src/cli.ts` imports GetSuperpower command helpers from `src/`.
- Tests no longer read `getsuperpower-command/package.json`.
- Root GetSuperpower command smoke tests still pass.
- `rtk bun run check` passes.
