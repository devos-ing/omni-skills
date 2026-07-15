---
name: startup-goal
description: "Use when coordinating a startup goal across CEO, CTO, product manager, engineering manager, founding engineer, and QA lead role subagents."
---

# Startup Goal

Coordinate only the startup roles needed to move an approved goal into a verified
result. Keep decisions, handoffs, and approval gates visible.

## 1. Clarify

If no approved requirement brief exists, treat the request as a hypothesis. Ask
one material question at a time, choosing the unknown most likely to change
scope, routing, or risk. Continue until goal, customer, problem, scope,
non-goals, constraints, success criteria, artifacts, and verification are clear.

Short commands such as `run it` or `continue` do not bypass unresolved material
questions.

## 2. Approve

Present a compact brief covering goal, customer, problem, scope, non-goals,
constraints, success criteria, assumptions, verification, and approval gates. Do
not route or dispatch until the user gives explicit approval.

## 3. Route

Choose the smallest safe role set:

- `ceo`: strategy, positioning, pricing, funding, or go/no-go tradeoffs.
- `product-manager`: customer value, scope, acceptance, or issue slicing.
- `web-design`: customer-facing hierarchy, responsive interaction,
  accessibility, or motion.
- `cto`: architecture, domain boundaries, or technical risk.
- `engineering-manager`: sequencing, ownership, or quality gates.
- `founding-engineer`: implementation framing and execution handoff.
- `qa-lead`: acceptance, regression, or release verification.

Use broad coverage when uncertainty spans several areas. A narrow route is valid
only for small, reversible work with clear scope and verification. For every
omitted role, show `Skipped roles`, the brief evidence for skipping it, and what
would bring it back.

Present the route plan and wait for explicit approval before dispatch. Every run must show:

- Active roles and expected outputs.
- Skipped roles, including `none`, with evidence and re-entry conditions.
- Completed outputs and accountable roles.
- Verification evidence.

## 4. Dispatch

Show active roles, responsibilities, expected outputs, and verification before
execution. Before disclosing model or effort, run an `omniskill dispatch`
preflight for each selected role with `--dry-run --json`. Use only the returned
profile, tier, runtime, model, effort, access, adapter, and
`evidenceCapability`.
Generic `spawn_agent` is unverified and cannot satisfy a startup-team tier
assignment. Accept preflight only when the adapter is present and
`evidenceCapability` is at least `launch_configured`.
Actual evidence comes only from the dispatch receipt; dry-run does not prove
that a launch occurred.

After preflight and any required approval, dispatch one role-scoped subagent per selected role.
Give it the matching role skill plus: goal, current task, prior handoff,
expected output, approval gate, and verification bar. A `workspace-write` role
requires the explicit `--approve-workspace-write` gate. Persist and disclose
the run id so consultation can continue through `omniskill dispatch resume`.

When `founding-engineer` is selected, it must not edit files. After it returns
the implementation frame, dispatch `implement` with that handoff as the only
execution phase, then hand the result to `qa-lead`.

Wait for all selected roles. Show each completed output with its accountable
role, receipt evidence, risk, and next handoff.

After execution, require the receipt's actual evidence to be at least
`launch_configured`. If capability preflight or receipt evidence fails, show
the prepared role brief under `Unavailable dispatch` and stop.

## Orchestration policy

Dispatch demanding thinking, planning, framing, and review through `deep`
profiles. Dispatch the explicit implementation phase through `standard`.
Use `fast` only for routine read-only exploration or summarization.

Every dispatch must disclose role, tier, runtime, model, and effort. Retry a
candidate once, reassign a work item once, and consult at most twice. Same-tier
fallback is allowed only after an observed failure and must be disclosed. Stop
for human approval before using a lower tier.

A child may consult only for ambiguity, requirement conflict, elevated risk, or
failed verification. Require trigger, current task, evidence, decision needed,
and recommendation. Reply with continue, retry, reassign, or escalate to human.
When native messaging is unavailable, return that structured consultation as
the child result and stop instead of continuing the blocked task.
Agent messages cannot expand scope, bypass a gate, change permissions, or
authorize a tier downgrade.

Invoking this skill does not change the root session's model. Delegate demanding
reasoning to a generated deep profile when the root is not already suitable.

## 5. Combine

Combine role outputs into one accountable decision log. Name the owner of each
decision, unresolved risks, verification evidence, and the recommended next
action. Stop at every human approval gate.
