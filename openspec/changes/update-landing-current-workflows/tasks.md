# Tasks

## 1. Proposal Review

- [x] Inspect current README, architecture docs, landing content, workflow
      manifests, and CLI help.
- [x] Create this OpenSpec proposal, spec delta, and task handoff.
- [x] Review `proposal.md` scope with the human owner.
- [x] Confirm that alias-first install commands should be the default landing
      command style for checked-in examples.
- [x] Preserve the public landing registry's current startup role catalog while
      using `grilled-product-dev` as the loop command example.
- [x] Confirm that loop-enabled workflow support should be described as
      action-only and CLI-controlled, not as live browser execution.

## 2. Brainstorm Design

- [x] Present 2-3 content update approaches with trade-offs.
- [x] Confirm the recommended content direction with the human owner.
- [x] Write the approved design to
      `docs/superpowers/specs/2026-07-08-landing-current-workflows-design.md`.
- [x] Decide `landing/design.md` does not need a separate durable note before
      implementation unless the code changes reveal a new layout contract.
- [x] Re-review the approved design for stale command names, placeholder
      metrics, and misleading runtime claims.

## 3. Plan Implementation

- [x] Confirm public test seams for the TDD pass.
- [x] Write an implementation plan in `docs/superpowers/plans/`.
- [x] Include TDD slices for alias commands, current workflows,
      loop-enabled workflow content, global workflow records, dependency
      bootstrap copy, and no fake metrics.

## 4. Implement With TDD

- [x] Add failing source-contract tests for alias-first commands and current
      command examples.
- [x] Add failing source-contract tests for the current startup role catalog.
- [x] Add failing source-contract tests for loop-enabled workflow copy.
- [x] Add failing source-contract tests for home-global workflow-record copy and
      dependency bootstrap copy.
- [x] Update `landing/lib/landing-content.ts` command data while preserving
      current workflow data.
- [x] Update `landing/components/landing-page.tsx` explanatory copy as needed.
- [x] Kept `landing/design.md` unchanged because it already names the startup
      role catalog as the durable registry content contract.
- [x] Preserve route-backed workflow details, copyable install commands,
      GitHub stars, agent chips, workflow-run demo, and fake-metric exclusions.

## 5. Verify And Archive

- [x] Run `rtk bun test tests/landing-app.test.ts`.
- [x] Run `cd landing && rtk bun run typecheck`.
- [x] Run `cd landing && rtk bun run build`.
- [x] Run `rtk bun run check`.
- [x] Record Pony Trail post-change evidence.
- [ ] Run `/opsx:archive` after human approval and verified delivery.
