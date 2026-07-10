# Startup Goal Chat and Checkpoints Demo Design

Date: 2026-07-10
Status: Approved for implementation planning

## Goal

Redesign the landing-page startup-goal simulation so a visitor can understand
three things at a glance:

1. which startup case is being processed;
2. how the coordinator and role agents communicate in chat; and
3. which workflow checkpoint the run has reached.

The demo remains deterministic local content. It does not execute agents in the
browser or imply live workflow status.

## Audience and problem

The target user is a landing-page visitor evaluating how startup-goal
coordinates specialist agents. The current demo duplicates role agents in a
left run-calls rail and in the transcript. It also processes roles one at a
time, which does not match the intended parallel dispatch shown by the
reference chat.

## Approved experience

At desktop widths, the workbench has three regions:

- Left: the existing Idea to v1, Pivot or focus, and Customer request cases.
- Center: the user, coordinator, parallel role launch, returned role outputs,
  and combined answer.
- Right: a compact read-only checkpoint rail.

On narrow screens, the regions stack as cases, chat, then checkpoints without
horizontal scrolling. The chat remains the dominant surface.

Selecting a case restarts the deterministic run. Replay restarts the selected
case. Both actions cancel the prior timer before resetting state.

## Scope

### Must have

- Keep the three existing cases, prompts, role content, and outcomes.
- Move case selection from the row above the workbench into the left rail.
- Remove the run-calls role list and selected-skill preview.
- Complete coordinator intake, brief approval, and routing before dispatch.
- Show all selected role agents starting together in the chat.
- Stream role returns in a stable case-defined order.
- Show the combined answer after every role has returned.
- Keep every coordinator and role skill discoverable through an accessible
  chat link to its existing SKILL.md source.
- Show exactly five read-only checkpoints:
  Intake, Brief approval, Route agents, Collect outputs, and Combined answer.
- Preserve Replay, automatic transcript scrolling, reduced-motion behavior,
  keyboard access, and the simulated/local disclosure.
- Add no runtime dependency or network-backed workflow state.

### Non-goals

- Live browser-side agent execution.
- New startup cases.
- Editable, expandable, or clickable checkpoints.
- Telemetry, random timing, or time-dependent copy.
- A broader landing-page or positioning redesign.

## Role decisions

- Product Manager owns the visitor contract, case preservation, and acceptance
  criteria.
- CTO owns the canonical phase model and the rule that all rendered views
  derive from it.
- Engineering Manager owns the test-first delivery sequence and quality gates.
- Founding Engineer owns the focused implementation seam and timer safety.
- QA Lead owns responsive, accessibility, concurrency, Replay, case-switch,
  and reduced-motion acceptance.
- CEO is skipped because the slice has no positioning, pricing, fundraising,
  or company-level go/no-go decision. CEO returns if scope expands into landing
  strategy.

## Alternatives considered

### Canonical phase model in the existing component

Recommended. Replace sequential role state with one discriminated run phase.
Derive chat, role status, and checkpoint status from it. Keep small private
render components in the existing demo file.

This balances a focused diff with protection against contradictory UI state.

### Minimal visual patch

Keep the sequential state machine but render every role as started. This has a
smaller diff, but the UI would claim parallel work while the model remains
sequential. It also retains synchronization risk across chat and checkpoints.

Rejected.

### Extracted workflow simulator module

Move a reducer and selectors into a new module with dedicated model tests. This
is the cleanest long-term boundary, but it adds refactoring beyond the needs of
one deterministic landing demo.

Deferred unless implementation shows the component cannot remain coherent.

## Data model

WorkflowCase explicitly owns:

- id, title, and subtitle;
- prompt and outcome;
- coordinator content; and
- ordered role runs.

Coordinator content and role runs share the role presentation fields needed by
chat, including skill id, owner, label, icon, response, and source URL. The
component does not rely on the first array entry being the coordinator.

The old case process-point chips are removed. The five checkpoint labels are a
fixed workflow contract, and their statuses are derived from the current run
phase.

## Run state

Use one discriminated RunPhase with these states:

1. typing, with the visible prompt character count;
2. intake;
3. approval;
4. dispatch;
5. collecting, with the returned-role count;
6. synthesizing; and
7. complete.

The transition into dispatch renders every selected role agent in one batch.
Collecting increments only the number of returned outputs. Outstanding roles
remain visibly active until their result is returned. Results use the stable
order declared by the selected case.

Checkpoint status is a pure projection:

- Intake is active during intake and complete afterward.
- Brief approval is active during approval and complete afterward.
- Route agents is active during dispatch and complete during collection.
- Collect outputs is active while returned-role count is below role count.
- Combined answer is active while synthesizing and complete when the outcome
  is visible.

No completed-step array, selected-role index, or separate checkpoint state is
retained.

## Components

WorkflowRunDemo owns:

- selected case;
- the canonical run phase;
- the active timer;
- transcript scroll ownership;
- Replay and case-selection reset behavior; and
- reduced-motion preference.

Three private render units stay in
landing/components/workflow-run-demo.tsx:

- CaseRail renders the case buttons and selected state.
- ChatTranscript renders the user prompt, coordinator activity, role launch
  batch, returned outputs, and combined answer.
- CheckpointRail renders the ordered read-only phase list.

These units receive data and derived status through props. They do not own
duplicate workflow state.

## Chat behavior

The visible sequence is:

1. the selected user prompt;
2. coordinator intake;
3. approved brief and routing explanation;
4. one group containing all role badges and the phrase started working;
5. deterministic role return messages; and
6. the combined answer.

Each role appears once in the launch group and once when its output returns.
Role badges are anchors with descriptive accessible labels, existing GitHub
source URLs, visible focus styles, target blank, and noreferrer.

The simulation disclosure remains visible in surrounding landing copy. The
demo performs no workflow, telemetry, or agent network request.

## Responsive layout

At the large breakpoint, use a three-column grid with compact left and right
rails and a flexible center chat. Each desktop region owns its vertical
overflow so the page does not become a nested horizontal scroll surface.

Below the large breakpoint, remove the fixed desktop height and stack the
regions. The case controls become a compact grid above the chat. The checkpoint
list appears below the chat. No content requires horizontal scrolling.

## Accessibility and reduced motion

- Case controls remain buttons with aria-pressed and visible keyboard focus.
- Replay remains a labelled keyboard-operable button.
- The checkpoint rail is a semantic ordered list with visible queued, active,
  and complete text. It contains no controls or links.
- Dynamic transcript updates use polite live-region semantics without moving
  focus.
- Status meaning is expressed in text, not only color.
- Reduced motion immediately renders the selected case in its completed state.
- Reduced motion disables typewriter, pulse, message-entry, and smooth-scroll
  animation.

## Failure and race handling

There is no external failure path because all data is local. Runtime safety
focuses on stale timers and invalid indexes:

- clear the owned timer before every new phase timer;
- clear it during Replay, case selection, effect cleanup, and unmount;
- fall back to the first case when the selected index is unavailable;
- clamp returned-role count to the selected case role count; and
- derive all visible state from the selected case and current phase.

These rules prevent prior-case messages, duplicate role returns, and
checkpoint drift.

## Test-first delivery

1. Update openspec/specs/getsuperpower-landing/spec.md to describe the
   three-region layout, parallel launch, chat source links, and read-only
   checkpoints. Remove the duplicated old selected-skill scenario.
2. Update tests/landing-app.test.ts so it rejects Run calls, Selected skill,
   selected-step state, and the old two-column layout while requiring the new
   contract.
3. Refactor landing/components/workflow-run-demo.tsx around the canonical
   phase model.
4. Run the focused landing test after each red/green step.
5. Run landing checks and the repository quality gate.
6. Inspect the live demo at desktop and narrow widths, including reduced
   motion and keyboard navigation.

## Acceptance

- Desktop visibly separates cases, chat, and checkpoints.
- The sidebars do not duplicate role agents.
- All role agents start together only after coordinator routing completes.
- No role result appears before the full role launch group.
- Role results and the combined answer appear in deterministic order.
- Case switching and Replay never leak stale output.
- All chat skill links are correct and keyboard reachable.
- The five checkpoints remain synchronized and non-interactive.
- Reduced motion renders an immediate stable completed state.
- Narrow layouts do not clip content or scroll horizontally.
- The demo remains deterministic, dependency-free, local, and explicitly
  simulated.
- The focused landing test, landing checks, and rtk bun run check pass.

## Expected files

- docs/superpowers/specs/2026-07-10-startup-goal-chat-checkpoints-design.md
- openspec/specs/getsuperpower-landing/spec.md
- tests/landing-app.test.ts
- landing/components/workflow-run-demo.tsx

## Rollback

Revert the implementation and spec commits. The current deterministic
two-column demo remains a complete fallback and requires no data migration.
