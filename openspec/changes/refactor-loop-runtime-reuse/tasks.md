# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Review reusable loop runtime scope with the human owner.
- [x] Decide where the shared Node runtime asset should live.
- [x] Decide whether install copies the shared runtime asset automatically or
      declares it in manifest metadata.
- [x] Decide whether a `getsuperpower loop` adapter belongs in v1 or should be
      deferred.
- [x] Decide whether the active internal `ponytrail` runtime namespace should
      be renamed as part of this refactor.

## 2. Brainstorm Design

- [x] Explore 2-3 reusable runtime approaches with trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for placeholders, contradictions, and scope
      creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for the runtime entrypoint, wrapper behavior,
      install-time copied files, non-loop workflow compatibility, and docs.

## 4. Implement With TDD

- [ ] Confirm the public seams under test before writing tests.
- [ ] Add a failing runtime-level test for command execution through the shared
      entrypoint.
- [ ] Extract the generic runtime behavior behind the shared entrypoint.
- [ ] Move active runtime modules from `src/runtimes/ponytrail/` to
      `src/runtimes/getsuperpower/` and update imports.
- [ ] Add a failing Node wrapper smoke test for the thin example `loop.mjs`.
- [ ] Reduce the example `loop.mjs` to the thin wrapper.
- [ ] Add a failing install-preparation test for copied shared runtime assets.
- [ ] Update install preparation to copy the shared runtime asset for looped
      workflows.
- [ ] Add compatibility coverage for non-loop workflows.
- [ ] Update author documentation.

## 5. Verify And Archive

- [ ] Run focused Bun tests for loop runtime and workflow-bundle installation.
- [ ] Run Node smoke checks against the example workflow loop.
- [ ] Run CLI validate/deps smoke checks for the example workflow.
- [ ] Run `rtk bun run check`.
- [ ] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
