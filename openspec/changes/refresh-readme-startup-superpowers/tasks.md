# Tasks

## 1. Proposal Review

- [x] Inspect current README, architecture docs, landing content, and attached
      screenshot.
- [x] Create this OpenSpec proposal, spec delta, and task handoff.
- [x] Review `proposal.md` scope with the human owner.
- [x] Confirm the README headline: "Power your ability."
- [x] Confirm the provided screenshot should become a repo-local README asset.
- [x] Confirm old README diagram embeds should be removed from primary content.

## 2. Brainstorm Design

- [x] Present 2-3 README structure approaches with trade-offs.
- [x] Confirm the recommended README structure with the human owner.
- [x] Write the approved design to `docs/superpowers/specs/`.
- [x] Re-review the written design for stale commands, vague claims, and
      unsupported automation promises.

## 3. Plan Implementation

- [ ] Confirm public test seams for the README TDD pass.
- [ ] Write an implementation plan in `docs/superpowers/plans/`.
- [ ] Include TDD slices for README positioning, startup role commands, goal
      loop copy, ecosystem copy, screenshot asset reference, and old diagram
      removal.

## 4. Implement With TDD

- [ ] Add failing README/source-contract tests for the new headline and product
      promise.
- [ ] Add failing tests for startup-team and individual role command coverage.
- [ ] Add failing tests for action-only goal loop copy.
- [ ] Add failing tests for Matt Pocock, Superpowers, Ponytrail, and future pack
      ecosystem copy.
- [ ] Add failing tests for the new README image asset and old diagram removal.
- [ ] Copy the provided screenshot into a stable repo asset path.
- [ ] Rewrite `README.md` to the approved structure.
- [ ] Preserve current command surfaces and avoid fake metrics or unsupported
      automation claims.

## 5. Verify And Archive

- [ ] Run README-focused tests.
- [ ] Run `rtk bun run check`.
- [ ] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval and verified delivery.
