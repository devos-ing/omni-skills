# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, loop-runtime spec delta, workflow-bundle spec
      delta, and task checklist.
- [x] Review `proposal.md` with the human owner.
- [x] Decide whether source workflows keep checked-in `loop.mjs` or generate it
      entirely from `workflow.json`.
- [x] Decide whether the generated `node loop.mjs` bridge may require the
      `getsuperpower` CLI on `PATH`.

## 2. Brainstorm Design

- [x] Compare generated CLI bridge, inline bundled runtime, and package-import
      runner options.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for placeholders, contradictions, and scope
      creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for validation semantics, install output, generated
      runner behavior, docs, and compatibility failures.

## 4. Implement With TDD

- [x] Confirm public seams before writing tests.
- [x] Add failing tests that installed looped entry skills no longer receive
      `loop-runtime.mjs`.
- [x] Add failing tests that installed `loop.mjs` is generated and forwards to
      `getsuperpower loop ...`.
- [x] Add failing validation tests for generated loop script semantics.
- [x] Implement the CLI-owned runner renderer.
- [x] Update grilled-product-dev workflow files and docs.
- [x] Preserve `getsuperpower loop start/status/log/advance/summary` behavior.

## 5. Verify And Archive

- [x] Run focused workflow-bundle, CLI, and loop-runtime tests.
- [x] Run smoke checks using `rtk bun run dev -- loop ...`.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
