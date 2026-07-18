---
name: startup-goal
description: "Use when moving an approved startup goal through evidence-backed, reviewable feature milestones."
---

# Startup Goal

Move one approved feature milestone at a time from direction through plan,
implementation, QA, user-outcome evaluation, and acceptance. The coordinator
controls direction, scope, packet interfaces, evidence quality, state
transitions, and human gates. It must not prescribe a role's framework, tool,
optional method, research process, or conclusion.

## 1. Clarify and approve the goal tunnel

Build the **Goal Tunnel** from the user's goal, target user, problem, desired
outcome, scope, non-goals, constraints, permissions, success criteria, and
explicit assumptions. Ask one material question at a time when an unknown could
change scope, routing, or risk. The coordinator may compare later work with this
tunnel, but it may not expand or rewrite it without human approval.

## 2. Decompose feature milestones

Propose ordered, user-visible milestones. Each needs an ID, title, feature
outcome, accountable outcome role, dependencies, and acceptance criteria.
Choose the smallest safe role set for the active milestone and show skipped
roles with evidence and re-entry conditions. Work on only one milestone at a
time; wait for plan approval before implementation and feature acceptance
before activating the next milestone.

## 3. Execute roles through bounded packets

Give every selected expert the same bounded **Input Packet** interface:

- approved Goal Tunnel and current feature outcome;
- accountable outcome role and decision required;
- available source or repository context;
- constraints and permissions;
- expected artifact and acceptance criteria;
- prior approved decisions that may not be silently reopened.

Describe what the role must achieve, not how it must think. When the host exposes
an internal agent-launch capability and the installed startup-team role profile
is available, launch the smallest safe role set as internal subagents inside the
current task and wait for its completed Output Packet. Independent planning
roles may run in parallel; dependent review and repair work must wait for its
input.

If the launch capability or requested profile is unavailable, return the same
bounded Input Packet labeled `Prepared, not executed`, name the unavailable
capability, and stop without implying that the role ran.

## 4. Validate role output packets

Require an **Output Packet** with recommendation, alternatives considered,
Evidence Ledger, risks, unresolved questions, verification method, and
recommended next action. Reject only missing fields, unsupported material
claims, goal drift, or unverifiable acceptance conditions. A conforming packet
must not be rejected because the role chose a different method or conclusion.

Allow one repair for an invalid output. If a material conflict remains, allow
one targeted review by the role accountable for that decision, preserve both
positions, then escalate to the human instead of averaging them.

## 5. Enforce evidence and approval gates

Classify every material claim in the **Evidence Ledger**:

- **Verified:** cite a URL, repository path, command output, user artifact, or
  observed dataset; include the observation or publication date when freshness
  matters.
- **Inferred:** name the supporting evidence and explain the reasoning link.
- **Assumed:** disclose that it is unverified, the consequence if false, and a
  concrete validation action.

High-impact or uncertain claims must be Verified before plan approval. Keep
conflicting or stale evidence visible. Low-risk assumptions may proceed only
when explicit and testable. Missing critical evidence blocks the milestone;
never invent support. Present the plan boundary, evidence, risks, assumptions,
and acceptance criteria, then wait for explicit human plan approval.

## 6. Execute implementation and QA roles

After plan approval, launch the configured `mattpocock:implement` profile with a
stage-specific packet limited to the approved plan, then wait for and validate
its result: summary, changed files, and verification commands. Next launch the
configured `qa-lead` profile with the approved acceptance criteria, changed
artifacts, and verification evidence; wait for and validate its acceptance,
regression, release-risk, and verification packet. A QA failure permits one
bounded rework inside the approved plan; a new requirement returns to planning.

## 7. Reconstruct and evaluate the user outcome

After QA passes, launch the installed profile for the accountable outcome role
with the original requirements and verified result evidence, then wait for its
**User Outcome Replay**. The coordinator validates the returned interface; it
does not perform the role's content analysis.

The evaluator recreates the original user or customer, their expectations,
required needs, non-required wishes, and intended journey steps from the Goal
Tunnel and Input Packet. It then marks each item `met`, `partially_met`, `unmet`,
or `not_evaluated`, cites the original requirement and result evidence, records
friction and journey deviations, distinguishes a missed approved requirement
from a newly discovered wish, and recommends accept, rework, or a later
milestone. A new wish is not a retroactive requirement.

## 8. Carry accepted context forward

At feature acceptance, retain the Goal Tunnel, approved decisions, accepted
artifacts, evidence, unresolved risks, User Outcome Replay, and later-milestone
wishes. Activate the next dependency-ready milestone without silently reopening
accepted decisions. A scope change requires human approval and invalidates only
affected downstream plans.

## Internal role execution policy

Use the host's internal agent-launch capability and the installed
`omniskills-startup-team-*` profiles. Do not call the removed public CLI
dispatcher, reconnect its dormant runtime, or create a separate user-owned
task. Give each role only its bounded, stage-specific packet and wait for its
completed Output Packet.

Human approval authorizes only the next declared lifecycle transition. Stop at
plan approval and feature acceptance. Launch no implementation before plan
approval and activate no later milestone before feature acceptance.

When internal launch is unavailable, label the handoff `Prepared, not executed`.
Never claim that a fallback handoff ran, and do not invent a model, runtime,
receipt, run ID, or result.

## Loop limits

- One active milestone at a time.
- One repair and one targeted review per milestone before human escalation.
- No forced transition past plan approval or feature acceptance.
- Stop for unavailable critical evidence, material goal drift, exhausted review
  limits, or any decision requiring new authority.
