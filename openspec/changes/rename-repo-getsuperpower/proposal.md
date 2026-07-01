# Proposal: Rename Public Repo Surface To GetSuperpower

## Summary

Rename the public package and CLI surface from Ponyrace to GetSuperpower:

```bash
getsuperpower install product-dev
getsuperpower clone product-dev
getsuperpower skills install creating-bundle-skills
```

Keep legacy compatibility where it avoids breaking existing scripts, but make
`getsuperpower` the package name, binary name, docs command, and release asset
name.

## Motivation

The project no longer exposes the old Ponyrace requirement-review runtime. The
repository now focuses on deployable GetSuperpower skill-tree bundles, so the
package and command vocabulary should match the product.

## Scope

In scope:

- Rename root package metadata to `getsuperpower`.
- Add `getsuperpower` as the primary binary.
- Keep the old `ponyrace` binary as a transition alias.
- Promote GetSuperpower commands to the root CLI so users run
  `getsuperpower install`, `getsuperpower clone`, and `getsuperpower deps`.
- Keep nested `getsuperpower`, `bundle`, and `workflow` command aliases for
  compatibility.
- Update README, author guide, examples, release asset naming, tests, and
  user-facing error messages.

Out of scope:

- Migrating existing legacy local state directories; current runtime state lives
  under `.getsuperpower/`.
- Renaming the `pony-trail` skill.
- Renaming the internal `src/runtimes/ponytrail/` folder.
- Performing the live GitHub repository rename.

## Acceptance Criteria

- `package.json` package name is `getsuperpower`.
- The primary CLI program name is `getsuperpower`.
- `getsuperpower install/clone/deps/init/validate/list` work at the root
  command level.
- Compatibility aliases still work.
- Public docs no longer teach `npx ponyrace getsuperpower ...`.
- `rtk bun run check` passes.
