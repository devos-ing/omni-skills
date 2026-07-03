---
name: development-design-delivery
description: Use when running a product-minded engineering workflow from request shaping through interface design, implementation, review, and evidence capture.
---

# Development Design Delivery GetSuperpower

This is the entry skill for the development-design-delivery GetSuperpower.

When this skill is used, run the workflow below in order. Load/use every
required sub-skill before doing the work for its phase.

## Required Sub-Skills

Before doing workflow work, load/use these skills in order:

1. superpowers:brainstorming - shape the request, context, constraints, and success criteria
2. mattpocock:design-an-interface - explore API, module, or UI interface options
3. mattpocock:grill-with-docs - stress-test the requirement and preserve design docs
4. superpowers:writing-plans - split approved scope into executable tasks
5. mattpocock:codebase-design - check module boundaries, seams, and testability
6. mattpocock:tdd - build task by task with failing tests first
7. mattpocock:diagnosing-bugs - diagnose unexpected failures or regressions when blocked
8. mattpocock:review - review changes against standards and the approved spec
9. pony-trail - record file-change evidence, verification, and rollback context

If any required sub-skill is unavailable, stop and tell the user which
dependency is missing. For missing `mattpocock:*` skills, tell the user to run:

```bash
getsuperpower skills install mattpocock/skills
```

## Flow

1. Shape the request and success criteria.
   - Skill: superpowers:brainstorming
   - Gate: wait for explicit human approval.
2. Explore API, module, or UI interface options.
   - Skill: mattpocock:design-an-interface
   - Gate: wait for explicit human approval.
3. Stress-test the plan and record docs.
   - Skill: mattpocock:grill-with-docs
   - Gate: wait for explicit human approval.
4. Write the task-by-task implementation plan.
   - Skill: superpowers:writing-plans
5. Check module boundaries and seams before implementation.
   - Skill: mattpocock:codebase-design
6. Implement with TDD.
   - Skill: mattpocock:tdd
7. Use systematic debugging if behavior is unexpected or tests fail.
   - Skill: mattpocock:diagnosing-bugs
8. Review the change against repo standards and the approved spec.
   - Skill: mattpocock:review
9. Preserve verification and rollback evidence.
   - Skill: pony-trail

## Author Notes

- Keep this entry skill, `workflow.json`, and `README.md` aligned when adding or removing steps.
- This skill orchestrates through required instructions; GetSuperpower installs and validates the dependency skills.
- Do not silently skip approval gates, interface exploration, implementation planning, TDD, review, or evidence capture.
