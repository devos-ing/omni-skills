# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, command spec delta, loop-runtime spec delta,
      and task checklist.
- [x] Review `proposal.md` with the human owner.
- [x] Decide whether loop commands require `<source>` every time or may also
      resolve installed workflow names from `~/.getsuperpower/workflows`.
- [x] Decide final CLI argument order for loop subcommands.

## 2. Brainstorm Design

- [x] Explore 2-3 CLI command-routing approaches with trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for placeholders, contradictions, and scope
      creep.

## 3. Plan Implementation

- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for CLI command registration, runtime command text,
      docs/entry-skill updates, and compatibility.

## 4. Implement With TDD

- [x] Confirm public seams before writing tests.
- [x] Add failing CLI tests for `getsuperpower loop start/status/log/advance/summary`.
- [x] Add failing assertions that runtime action commands use
      `getsuperpower loop ...` instead of `node loop.mjs ...`.
- [x] Implement the CLI loop command by routing to the reusable runtime.
- [x] Update docs and entry-skill instructions.
- [x] Preserve direct Node wrapper compatibility with explicit tests.

## 5. Verify And Archive

- [x] Run focused loop CLI and runtime tests.
- [x] Run smoke checks using `rtk bun run dev -- loop ...`.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
