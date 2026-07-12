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
- `founding-engineer`: implementation.
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
execution. Dispatch one role-scoped subagent per selected role and give it the
matching role skill plus: goal, current task, prior handoff, expected output,
approval gate, and verification bar.

Wait for all selected roles. Show each completed output with its accountable
role, evidence, risk, and next handoff. If dispatch is unavailable, show the
prepared briefs under `Unavailable dispatch` and stop.

## 5. Combine

Combine role outputs into one accountable decision log. Name the owner of each
decision, unresolved risks, verification evidence, and the recommended next
action. Stop at every human approval gate.
