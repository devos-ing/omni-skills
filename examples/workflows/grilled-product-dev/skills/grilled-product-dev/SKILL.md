---
name: grilled-product-dev
description: Use when shaping a product-development request that should be grilled before Superpowers design and planning.
---

# Grilled Product Dev GetSuperpower

This is the entry skill for the grilled-product-dev GetSuperpower.

When this skill is used, run the workflow below in order. Load/use every
required sub-skill before doing the work for its phase.

## Required Sub-Skills

Before doing workflow work, load/use these skills in order:

1. mattpocock:grilling - interview the human one question at a time and recommend answers until the request is sharp
2. superpowers:brainstorming - turn the approved direction into a design and written spec
3. superpowers:writing-plans - split the approved design into executable tasks

If any required sub-skill is unavailable, stop and tell the user which
dependency is missing.

## Flow

1. Sharpen the request through Matt Pocock grilling.
   - Skill: mattpocock:grilling
   - Gate: wait for explicit human approval that the grilled direction is ready.
2. Turn the approved direction into a Superpowers design.
   - Skill: superpowers:brainstorming
   - Gate: wait for explicit human approval of the design and written spec.
3. Write the implementation plan.
   - Skill: superpowers:writing-plans

## Author Notes

- Keep this entry skill, `workflow.json`, and `README.md` aligned when adding or removing steps.
- `superpowers:brainstorming` expects `superpowers:writing-plans` to be the next implementation skill, so grilling runs before brainstorming in this workflow.
- This skill orchestrates required instructions; GetSuperpower installs and validates the dependency skills.
