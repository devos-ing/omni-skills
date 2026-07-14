---
name: development-design-delivery
description: Use when running a product-minded engineering workflow from request shaping through interface design, implementation, review, and evidence capture.
---

# Development Design Delivery Omniskills Workflow

This is the entry skill for the development-design-delivery Omniskills workflow.

When this skill is used, run the workflow below in order. Load/use every
required sub-skill before doing the work for its phase.

## Required Sub-Skills

Before doing workflow work, load/use these skills in order:

1. superpowers:brainstorming - shape the request, context, constraints, and success criteria
2. mattpocock:prototype - build a throwaway interface prototype to explore API, module, or UI options
3. mattpocock:grill-with-docs - stress-test the requirement and preserve design docs
4. superpowers:writing-plans - split approved scope into executable tasks
5. mattpocock:codebase-design - check module boundaries, seams, and testability
6. mattpocock:tdd - build task by task with failing tests first
7. mattpocock:diagnosing-bugs - diagnose unexpected failures or regressions when blocked
8. mattpocock:code-review - review changes against standards and the approved spec
9. superpowers:verification-before-completion - verify results before claiming completion

If any required sub-skill is unavailable, stop and tell the user which
dependency is missing. For missing `mattpocock:*` skills, tell the user to run:

```bash
omniskill skills install mattpocock/skills
```

## Flow

1. Shape the request and success criteria.
   - Skill: superpowers:brainstorming
   - Gate: wait for explicit human approval.
2. Build a throwaway interface prototype to explore API, module, or UI options.
   - Skill: mattpocock:prototype
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
   - Skill: mattpocock:code-review
9. Verify the result before claiming completion.
   - Skill: superpowers:verification-before-completion

## Author Notes

- Keep this entry skill, `workflow.json`, and `README.md` aligned when adding or removing steps.
- This skill orchestrates through required instructions; Omniskills installs and validates the dependency skills.
- Do not silently skip approval gates, throwaway interface prototyping, implementation planning, TDD, review, or verification.
