---
name: startup-goal
description: "Use when preparing startup-goal handoffs across CEO, CTO, product manager, engineering manager, founding engineer, and QA lead roles."
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
not route or prepare handoffs until the user gives explicit approval.

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

Present the route plan and wait for explicit approval before preparing handoffs. Every run must show:

- Active roles and expected outputs.
- Skipped roles, including `none`, with evidence and re-entry conditions.
- Completed outputs and accountable roles.
- Verification evidence.

## 4. Prepare handoffs

Automatic role launch is disabled. Do not call a dispatch command or any other
agent-launch API.

For every selected role, prepare a handoff containing the matching role skill,
goal, current task, prior handoff, expected output, approval gate, constraints,
and verification bar. Label every handoff `Prepared, not executed`.

When `founding-engineer` is selected, prepare its implementation frame as a
read-only handoff. Prepare a separate `implement` execution handoff and a final
`qa-lead` verification handoff, but do not execute any of them.

Stop after presenting the handoffs. Continue only when the user supplies
completed role outputs in a later interaction. A prepared handoff is not
evidence that a role ran.

## Manual execution policy

Do not disclose a runtime, model, effort, adapter, evidence capability,
receipt, or run ID because no launch occurred. Human approval of a route
authorizes handoff preparation only; it does not authorize automatic execution.

## 5. Combine

Combine only completed role outputs that the user supplies in a later
interaction. Produce one accountable decision log that names the owner of each
decision, unresolved risks, verification evidence, and the recommended next
action. Stop at every human approval gate.
