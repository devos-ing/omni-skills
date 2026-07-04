# Tasks

## 1. Proposal Approval

- [x] Create OpenSpec proposal, spec delta, and task checklist.
- [x] Review alias scope with the human owner.
- [x] Decide whether v1 aliases are limited to lowercase kebab-case names.
- [x] Decide whether command output should show the resolved canonical URL.

## 2. Brainstorm Design

- [x] Explore alias resolver approaches and trade-offs.
- [x] Confirm the recommended design with the human owner.
- [x] Save the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for placeholders, contradictions, and scope
      creep.

## 3. Plan Implementation

- [x] Design doc reviewed and approved by the human owner.
- [x] Write the implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for source parsing, alias-not-found handling,
      install integration, validate/deps integration, docs, and smoke
      checks.

## 4. Implement With TDD

- [x] Add a failing runtime test for loading `openspec-superpowers` as an alias.
- [x] Implement minimal alias normalization to the canonical examples git URL.
- [x] Add a failing install test proving alias installs store canonical source
      metadata and resolve local workflow skills from the fetched checkout.
- [x] Implement install integration through the shared source loader.
- [x] Add failing validate/deps tests for alias sources.
- [x] Add a failing unknown-alias test with a clear not-found error.
- [x] Implement the unknown-alias error path.
- [x] Update README and author guide examples.

## 5. Verify And Archive

- [x] Run focused Bun tests for workflow bundles and GetSuperpower commands.
- [x] Run CLI smoke checks against a scratch directory under `work/`.
- [x] Run `rtk bun run check`.
- [x] Record Ponytrail post-change evidence.
- [ ] Run `/opsx:archive` after human approval.
