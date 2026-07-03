# Proposal: Refine Onboard Selection Flow

## Summary

Change `getsuperpower onboard` from sequential yes/no setup prompts into a
logo-first onboarding flow with one interactive checklist.

The command should:

1. Print the GetSuperpower logo/banner first.
2. Show the target workspace.
3. Ask the user what they want to install or set up using a space-select
   multi-select prompt.
4. Include global skills such as `pony-trail` and tools such as RTK and
   CodeGraph.
5. Run only the selected setup actions.

## Motivation

The current onboard command checks RTK and CodeGraph in sequence, asking one
yes/no question per missing setup area. That works, but it does not feel like a
true onboarding flow: the user cannot see the full menu of choices, and adding
global skills such as `pony-trail` would make the sequential prompt flow noisy.

A checklist-style onboard flow lets users decide up front what they want:

- install useful global agent skills;
- set up command/token-saving tools;
- initialize code-intelligence tooling;
- skip anything they do not want right now.

## Scope

In scope:

- Print the GetSuperpower logo/banner before the onboard checklist.
- Replace the current sequential RTK/CodeGraph confirmations with a multi-select
  prompt.
- Add a global skills section with at least `pony-trail`.
- Add a tools section with RTK and CodeGraph.
- Let users select or unselect items with the terminal multi-select UI.
- Keep already-ready status detection for RTK and CodeGraph.
- Install selected global skills through the existing skill installer seam.
- Run selected tool setup through injectable command-runner seams.
- Keep tests fully sandboxed: no real home mutation, no real RTK install, and no
  real CodeGraph indexing.

Out of scope:

- Adding a hosted registry or remote workflow browser.
- Installing arbitrary skills not listed by the onboard menu.
- Reintroducing paused Pony Trail history, revert, prehook, Ponyrace, or
  requirement-court command surfaces.
- Making `onboard` mutate the user's real home directory in tests.
- Adding a new dependency if `@clack/prompts` already supports multi-select.

## Proposed Behavior

When a user runs:

```bash
getsuperpower onboard
```

the CLI should print the normal GetSuperpower brand signal first, then show a
single checklist similar to:

```text
Select what to install or set up

Global skills
  [x] pony-trail

Tools
  [x] RTK
  [x] CodeGraph
```

The terminal UI should use the standard space-to-select/unselect interaction
provided by the prompt library.

## Acceptance Criteria

- `getsuperpower onboard` prints the GetSuperpower logo/banner before prompting.
- The onboard flow asks one multi-select question for setup choices.
- The multi-select includes `pony-trail`, RTK, and CodeGraph.
- Selected `pony-trail` installs through the existing skill installer path for
  configured/global agent targets.
- Selected RTK keeps the existing readiness check and setup guidance behavior.
- Selected CodeGraph keeps the existing `.codegraph/` readiness check and
  `codegraph init -i` behavior.
- Unselected items are skipped without running their setup action.
- Tests can inject selected onboard items without a real terminal.
- Tests can inject command results without invoking real `rtk` or `codegraph`.
- Existing `install`, `clone`, `deps`, `validate`, `list`, and `skills`
  behavior remains unchanged.
- `rtk bun run check` passes before delivery.

## Open Questions

- Should `pony-trail` install to all supported agent targets by default, or
  follow the existing `codex,claude,cursor` default used by workflow installs?
- Should the checklist include the GetSuperpower authoring skill
  `creating-bundle-skills` now, or keep v1 to `pony-trail`, RTK, and CodeGraph?
- Should RTK stay guidance-only when missing, or should selecting RTK attempt an
  executable install command in a future change?
