# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [ ] Review the logo-first multi-select onboard scope with the human owner.
- [ ] Confirm default agent targets for global skill installs.
- [ ] Confirm whether `creating-bundle-skills` belongs in v1 or a later change.
- [ ] Confirm RTK remains guidance-only when missing.

## 2. Brainstorm Design

- [ ] Explore the current onboard prompt and command-runner seams.
- [ ] Present 2-3 onboard menu designs with trade-offs.
- [ ] Get explicit design approval before implementation.
- [ ] Save the approved design to `docs/superpowers/specs/`.

## 3. Plan Implementation

- [ ] Write the implementation plan in `docs/superpowers/plans/`.
- [ ] Include TDD slices for logo output, injected multi-select choices, skill
      install selection, RTK selection, CodeGraph selection, skip behavior, and
      smoke checks.

## 4. Implement With TDD

- [ ] Confirm the public test seams before writing tests.
- [ ] Add failing tests for logo-first onboard output.
- [ ] Add failing tests for a multi-select prompt seam.
- [ ] Add failing tests for selected `pony-trail` install.
- [ ] Add failing tests for unselected items being skipped.
- [ ] Add failing tests for selected RTK and CodeGraph behavior.
- [ ] Implement the minimal onboard selection flow.
- [ ] Update help/docs where the onboard behavior is described.

## 5. Verify And Archive

- [ ] Run focused onboard tests.
- [ ] Run CLI smoke checks against a scratch directory under `work/`.
- [ ] Run `rtk bun run check`.
- [ ] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
