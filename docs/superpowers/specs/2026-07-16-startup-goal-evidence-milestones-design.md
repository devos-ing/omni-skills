# Evidence-Backed Startup Goal Milestones

**Status:** Approved design

**Date:** 2026-07-16

## Context

`startup-goal` currently describes one broad route from requirements through
planning, implementation, and QA. A large goal can therefore feel like one long
operation: the user cannot easily confirm direction before expensive work, and
the coordinator can over-prescribe which skills expert roles must use.

The current startup-team coordinator prepares manual handoffs because automatic
role launch is disabled. This design keeps that safety constraint. It defines a
resumable milestone contract that works with manual handoffs now and can support
a future executor without changing the role interfaces.

## Decision

Break an approved startup goal into large, user-visible feature milestones. Run
one milestone at a time through planning, plan approval, implementation,
verification, and feature acceptance.

The coordinator controls the goal tunnel, role inputs, required outputs,
evidence quality, state transitions, and approval gates. Expert roles control
their analysis, tools, frameworks, optional skills, and conclusions.

Plan evidence is risk-based. High-impact or uncertain claims require support
before approval. Low-risk unverified claims may proceed only when they are
explicit assumptions with a consequence and validation action.

## Goals

- Let the user review direction before a milestone consumes implementation time.
- Make every material plan claim traceable to evidence, inference, or an
  explicit assumption.
- Keep role reasoning open-ended while holding every output to a small,
  predictable interface.
- Persist enough state to resume from the last incomplete gate.
- Prevent duplicate implementation and repeated skill-search or review loops.
- Preserve visible role selection, skipped-role rationale, decisions, and
  verification evidence.

## Non-goals

- Re-enable automatic dispatch or agent launch.
- Select mandatory external data providers, research frameworks, or role tools.
- Require every role or companion skill for every milestone.
- Score plans with a single numeric evidence grade.
- Average material disagreements into artificial consensus.
- Allow the coordinator to replace an expert conclusion merely because it used
  an unexpected method.

## Approaches Considered

### Contract-first milestones (selected)

Each milestone has a fixed input packet, output packet, evidence contract, and
state machine. It provides strong direction control with minimal interference
in expert reasoning.

### Full review panel

CEO, product, design, technology, delivery, and QA roles could review every
plan. This provides broad coverage but makes small milestones slow and
increases the chance that orchestration rewrites content unnecessarily.

### Numeric evidence scoring

A score would be easy to compare and automate, but it would reward checkbox
completion and hide the difference between one critical unsupported assumption
and several low-value citations.

The selected design uses contract-first milestones and invokes targeted review
only when risk triggers it.

## Architecture

The design places the seam between orchestration and expert reasoning at the
role handoff. Five modules sit behind that seam.

### Goal Tunnel

The approved goal tunnel contains:

- goal and target user;
- problem and desired outcome;
- scope and non-goals;
- constraints and permissions;
- success criteria;
- approved assumptions;
- milestone order and dependencies.

The coordinator may compare work against the tunnel. It may not add a new goal,
expand scope, or change a constraint without human approval. A material tunnel
change invalidates affected downstream milestone plans, not accepted milestones
that remain compatible.

### Milestone State

Only one feature milestone is active at a time. Its states are:

```text
preparing
  -> planning
  -> awaiting_plan_approval
  -> implementing
  -> verifying
  -> awaiting_acceptance
  -> accepted
```

`planning` moves to `needs_evidence` only when a material evidence gap exists;
`needs_evidence` returns to `planning` when that gap is resolved.
`blocked` is available from any active state when progress requires human
authority, unavailable critical evidence, or resolution of a material
disagreement. Verification failure moves the milestone to `rework`, which
returns to `implementing` only for work inside the approved plan. A newly
discovered requirement returns it to `planning`.

The implementation should persist this state under the existing Omniskills run
area, `~/.omniskills/runs/<workflow>/<run-id>/`, and deepen the existing loop
runtime rather than put persistence behavior inside role skills.

### Input Packet

Every selected role receives the same small input interface:

- approved goal tunnel;
- current feature outcome;
- available source and repository context;
- constraints and permissions;
- decision required;
- expected artifact;
- acceptance criteria;
- prior approved decisions that may not be silently reopened.

The packet describes what the role must achieve, not how it must think.

### Output Packet

Every role returns:

- recommendation;
- alternatives considered;
- evidence ledger;
- inferences and their supporting evidence;
- explicit assumptions;
- risks and unresolved questions;
- verification method;
- recommended next action.

The coordinator validates this interface. It may request repair for a missing
field, unsupported material claim, goal drift, or unverifiable acceptance
condition. It may not reject a conforming output solely because the role chose
a different framework, tool, research method, or conclusion.

### Evidence Ledger

Each material claim is classified as one of:

- **Verified:** cites a source URL, repository path, command output, user-provided
  artifact, or observed dataset. Time-sensitive evidence records its observed or
  publication date.
- **Inferred:** identifies the supporting evidence and explains the reasoning
  that connects it to the conclusion.
- **Assumed:** states that it is unverified, describes the consequence if false,
  and provides a validation action.

Evidence requirements are risk-based:

- high-impact or uncertain claims must be verified before plan approval;
- conflicting material sources remain visible and require a relevance
  assessment;
- stale material evidence must disclose why it may no longer be reliable;
- low-risk assumptions may proceed when they are explicit and testable;
- unavailable critical evidence moves the milestone to `needs_evidence` rather
  than causing the role to invent support.

## Milestone Lifecycle

### 1. Prepare

Define the feature outcome, dependencies, constraints, source packet, and
observable acceptance criteria.

### 2. Plan

Select the smallest safe role set. Roles choose their own reasoning methods and
optional skills, then return output packets.

### 3. Review

The coordinator checks goal alignment, interface completeness, evidence
coverage, and unresolved risk. A specialist review is added only when product,
design, technical, delivery, financial, or release risk warrants it.

### 4. Plan approval

Show the user the plan, evidence ledger, assumptions, disagreements, risks, and
expected implementation scope and risk. Available decisions are `approve`,
`revise`, `research`, `skip`, and `stop`.

### 5. Implement

One execution role edits files according to the approved milestone plan. Any
material direction or scope change returns to plan approval.

### 6. Verify

QA checks the approved acceptance criteria and records concrete evidence,
untested areas, deviations, and residual risk.

### 7. Feature acceptance

Show delivered behavior and verification evidence. Available decisions are
`accept`, `rework`, `rollback`, and `stop`.

### 8. Carry forward

Accepted decisions, outputs, and evidence become read-only context for the next
milestone unless a later approved change explicitly invalidates them.

## Skill Contract Changes

### Startup Goal Coordinator

`startup-goal` owns clarification, milestone decomposition, role routing,
handoff interfaces, evidence gates, state transitions, and decision-log
continuity. It must explicitly say that it cannot prescribe role frameworks,
conclusions, research methods, or companion skills.

### Expert Roles

Each role skill should contain only:

- role purpose and decision rights;
- expected inputs;
- promised outputs;
- domain principles;
- evidence and risk responsibilities;
- conditions requiring human escalation.

Rename `Required Companion Skills` to `Optional Methods`. Remove every hard stop
caused solely by an unavailable companion skill. Role workflow manifests may
declare companion skills as installable capabilities, but must not represent
them as an unconditional execution chain.

Role-specific behavior becomes:

- CEO: return direction, tradeoffs, evidence, and the next experiment without a
  mandatory strategy framework.
- Product manager: return customer outcome, scope, acceptance, and sequencing
  without always producing a PRD, tickets, and delivery plan.
- Web design: return usable direction, responsive and accessibility constraints,
  and implementation expectations; run motion review only when motion changed.
- CTO: return the architecture decision, technical risk, and verification gate;
  use domain modeling, debugging, or code review only when relevant.
- Engineering manager: return executable sequencing and proportional quality
  gates; TDD is an available method rather than a universal requirement.
- QA lead: verify acceptance and evidence independently without rewriting
  product direction.

### Founding Engineer and Implement

Remove the current execution overlap:

- `founding-engineer` is read-only and returns the implementation framing,
  seams, risks, and verification strategy;
- `implement` is the only file-editing execution phase;
- `qa-lead` independently verifies the implemented milestone.

The startup-team orchestration assignment and role skill text must agree on this
seam.

## Manual-First Operation

Automatic launch remains disabled. In the first version, every lifecycle action
produces a manual handoff labeled `Prepared, not executed` and persists the
milestone state. The user runs the handoff in a separate task and returns the
completed output packet.

The coordinator combines only supplied completed outputs. Preparing a handoff
is never execution evidence. A future executor may consume the same packets and
state transitions, so automatic launch can be added later without changing the
role contracts.

## Failure Handling and Loop Limits

- Missing optional skill: continue with available reasoning and tools.
- Invalid output packet: request one contract repair, then mark `blocked`.
- Material disagreement: allow one targeted second review, then escalate with
  both positions and evidence.
- Missing critical evidence: move to `needs_evidence`.
- Conflicting evidence: preserve the conflict and request a human decision only
  when it changes direction.
- Goal or scope drift: stop before implementation and show the delta from the
  approved tunnel.
- New requirement during implementation: return to `planning`.
- Failed verification: return concrete reproduction evidence and affected
  acceptance criteria under `rework`.
- Accepted milestone: do not rerun unless an approved later change invalidates
  it.

These rules cap autonomous repair at one output repair and one targeted second
review. The coordinator must not enter recursive skill discovery or consensus
loops.

## Persistence and Resume

Persist after every state transition:

- goal tunnel and milestone map;
- current milestone and state;
- approved input packets;
- role outputs and evidence ledgers;
- human decisions;
- verification results;
- downstream milestones affected by a change.

Resume continues from the last incomplete gate. It must not repeat accepted
milestones or silently regenerate approved plans.

## Verification Strategy

Add focused tests for:

- valid and invalid input/output packets;
- rejection of unsupported high-risk claims;
- acceptance of explicit, low-risk assumptions with validation actions;
- invalid state transitions and skipped human gates;
- resume behavior that does not repeat accepted milestones;
- scope-change invalidation of affected downstream plans;
- one-repair and one-second-review loop limits;
- optional companion skills that do not block a role;
- role manifests that do not force every companion skill to run;
- `founding-engineer` framing without file edits;
- `implement` as the only workspace-write execution phase;
- conditional specialist review;
- visible current milestone, evidence, available decisions, and resume behavior
  in manual CLI smoke checks.

Run the existing startup-team dependency and validation checks plus the full
repository gate after implementation.

## Acceptance Criteria

- A large approved goal can be decomposed into ordered feature milestones.
- The user can approve or revise each feature plan before implementation.
- The user can accept or rework each verified feature before the next milestone.
- Every material plan claim is verified, inferred from named evidence, or an
  explicit assumption.
- Unsupported high-impact claims cannot pass plan approval.
- The coordinator enforces direction and output quality without prescribing
  expert methods or conclusions.
- Missing optional companion skills do not block role work.
- Founding engineer framing and file-editing implementation cannot both execute
  the same responsibility.
- A paused run resumes from its last incomplete gate without repeating accepted
  work.
- Existing automatic-launch safety remains unchanged.

## Rollback

The documentation change is isolated and can be reverted directly. A later
implementation should remain separable into skill-contract, manifest,
milestone-state, and test commits so any behavior layer can be reverted without
restoring mandatory role methods or automatic launch.
