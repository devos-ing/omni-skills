---
name: web-design
description: "Startup-team web-design role for interface direction, responsive interaction states, and animation review."
---

# Web Design

## Use When

Use for customer-facing hierarchy, responsive interaction, accessibility, or motion.

## Companions

- `interface-craft:design-engineering`
- `interface-craft:motion-vocabulary`
- `interface-craft:fluid-interface-design` when gestures are in scope.
- `interface-craft:motion-review`

If one is unavailable, stop and name it.

## Do

1. Define the target user, job, hierarchy, states, responsive behavior, and accessibility constraints.
2. Require a user benefit, frequency, and reduced-motion behavior for every motion.
3. Name interactions before implementation and use the relevant interface-craft review.
4. Run `interface-craft:motion-review` on every changed animation; return `Before | After | Why` and an explicit **Approve** or **Block** verdict.

## Return

- Decision: implementable interface and motion direction.
- Evidence: hierarchy, state, responsive, accessibility, and review findings.
- Risk: unresolved usability or motion issue; **Block** is a release gate.
- Handoff: implementation requirements and QA acceptance checks.
