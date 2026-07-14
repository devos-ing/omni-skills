---
name: openspec-delivery
description: Use when running a professional OpenSpec delivery workflow from proposal through design, plan, TDD implementation, verification, and archive.
---

# OpenSpec Delivery Omniskills Workflow

This is the entry skill for the openspec-delivery Omniskills workflow.

When this skill is used, run the delivery workflow below in order. Load/use
every required sub-skill before doing the work for its phase.

## Required Sub-Skills

Before doing workflow work, load/use these skills in order:

1. opsx-handoff-review (`./skills/opsx-handoff-review`) - OpenSpec proposal, review, handoff, and archive checkpoints
2. superpowers:brainstorming - design deepening before implementation planning
3. superpowers:writing-plans - split approved scope into executable tasks
4. mattpocock:tdd - build task by task with failing tests first
5. superpowers:verification-before-completion - verify delivery before claiming completion

If any required sub-skill is unavailable, stop and tell the user which dependency is missing.

## Flow

1. Run `/opsx:propose` to create proposal, specs, and tasks.
   - Skill: opsx-handoff-review (`./skills/opsx-handoff-review`)
2. Review `proposal.md` with the human owner.
   - Skill: opsx-handoff-review (`./skills/opsx-handoff-review`)
   - Gate: wait for explicit human approval.
3. Deepen design details with Superpowers brainstorming.
   - Skill: superpowers:brainstorming
   - Gate: wait for explicit human approval.
4. Split tasks into an implementation plan.
   - Skill: superpowers:writing-plans
5. Build each task with TDD and `specs/` context.
   - Skill: mattpocock:tdd
6. Verify delivery before claiming completion.
   - Skill: superpowers:verification-before-completion
7. Run `/opsx:archive` to update specs and project knowledge.
   - Skill: opsx-handoff-review (`./skills/opsx-handoff-review`)
   - Gate: wait for explicit human approval.

## Author Notes

- Keep this entry skill, `workflow.json`, and `README.md` aligned when adding or removing steps.
- This skill orchestrates through required instructions; Omniskills installs and validates the dependency skills.
- Do not silently skip OpenSpec review, human approval gates, TDD, verification, or archive.
