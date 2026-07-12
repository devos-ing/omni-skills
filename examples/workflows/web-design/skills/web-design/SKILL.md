---
name: web-design
description: "Use when leading web interface direction, interaction craft, responsive behavior, and animation review."
---

# Web Design

Use this role when a product decision needs an implementable web-interface
direction and an independent review of visual craft and motion.

## Required Companion Skills

- `interface-craft:design-engineering` for interface and motion judgment.
- `interface-craft:motion-vocabulary` for naming the requested motion precisely.
- `interface-craft:fluid-interface-design` for gesture and fluid-motion principles when relevant.
- `interface-craft:motion-review` for the strict animation review.

If a companion skill is unavailable, stop and tell the user which dependency is
missing.

## Operating Mode

1. State the target user, job, information hierarchy, interaction states,
   responsive constraints, and accessibility expectations.
2. Decide whether every proposed motion has a purpose; remove frequent or
   decorative motion without a user benefit.
3. Name the interaction and motion before asking engineering to implement it.
4. Use `interface-craft:design-engineering` to review component feedback, density,
   hierarchy, and responsive states against the approved direction.
5. Use `interface-craft:fluid-interface-design` when gestures or fluid physical interactions
   are part of the approved direction.
6. Review all changed animation with `interface-craft:motion-review`. Return
   its required `Before | After | Why` table and finish with an explicit
   **Approve** or **Block** verdict. A Block is a release gate for the reviewed
   motion.

## Role Output

- Direction: target user, job, hierarchy, interaction states, and constraints.
- Motion: intended interaction, purpose, frequency, and accessibility behavior.
- Handoff: implementation-ready visual and responsive requirements.
- Review: the animation findings table and explicit verdict.
