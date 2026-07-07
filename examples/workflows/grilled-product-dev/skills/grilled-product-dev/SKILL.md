---
name: grilled-product-dev
description: Use when shaping a product-development request that should be grilled before Superpowers design and planning.
---

# Grilled Product Dev GetSuperpower

This is the entry skill for the grilled-product-dev GetSuperpower.

When this skill is used, run the workflow below in order. Load/use every
required sub-skill before doing the work for its phase.

## Loop Runtime

Use the GetSuperpower CLI to track the workflow run. The runtime only prints
actions; you still decide and perform the actual work. Use the `workflow.json`
file copied next to this skill as the loop `<source>` when running from an
installed skill directory.

1. Start or resume a run:
   - New run: `getsuperpower loop start <source> --json`
   - Existing run: `getsuperpower loop status <source> --latest --json`
2. Before every phase, run `getsuperpower loop status <source> --run <run-id> --json`.
3. Follow the returned `actions` and the exact phase `instruction`.
4. After phase work, log a structured event, for example:
   `getsuperpower loop log <source> --run <run-id> --type phase_result --message "..."`
5. When the human gate is satisfied, run `getsuperpower loop advance <source> --run <run-id> --json`.
6. Repeat status, phase work, log, and advance until the workflow is complete.

The installed entry skill also gets a generated `loop.mjs` compatibility
wrapper, but agents should prefer the CLI command above.

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
   - Instruction: Ask one grilling question, include your recommended answer, and wait for explicit human approval before advancing.
   - Gate: wait for explicit human approval that the grilled direction is ready.
2. Turn the approved direction into a Superpowers design.
   - Skill: superpowers:brainstorming
   - Instruction: Turn the approved direction into a Superpowers design spec, then wait for explicit human approval before advancing.
   - Gate: wait for explicit human approval of the design and written spec.
3. Write the implementation plan.
   - Skill: superpowers:writing-plans
   - Instruction: Write the approved implementation plan as small executable tasks, then log the plan result.

## Author Notes

- Keep this entry skill, `workflow.json`, and `README.md` aligned when adding or removing steps.
- `superpowers:brainstorming` expects `superpowers:writing-plans` to be the next implementation skill, so grilling runs before brainstorming in this workflow.
- This skill orchestrates required instructions; GetSuperpower installs and validates the dependency skills.
