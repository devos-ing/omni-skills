---
name: writing-workflow-skills
description: Use when writing or reviewing Omniskills workflow skill files, entry skills, local role skills, step instructions, approval gates, handoffs, or Superpowers/Matt Pocock dependency choices.
---

# Writing Workflow Skills

## Overview

Use this skill to write the `SKILL.md` files inside an Omniskills workflow.
Use `creating-bundle-skills` for the whole bundle; use this skill for the entry
skill and local skills that make the workflow behave well after install.

Core principle: every workflow skill must make routing, dependencies, gates,
outputs, and handoffs explicit enough that another agent can run it without
inventing the process.

## Scope

- Entry skill: `skills/<workflow-name>/SKILL.md`, the callable coordinator.
- Local skill: `skills/<local-skill>/SKILL.md`, a workflow-specific phase or role.
- Manifest alignment: `workflow.json` `skills[]`, `steps[]`, `gate`, and
  `steps[].instruction`.

Do not use this as a replacement for generic skill authoring. For standalone
skills, use `superpowers:writing-skills` or the platform skill creator.

## Dependency Palette

| Need | Prefer |
| --- | --- |
| Requirement intake, options, user approval | `superpowers:brainstorming` |
| Implementation plans | `superpowers:writing-plans` |
| Test-first implementation | `mattpocock:tdd` or `superpowers:test-driven-development` |
| Completion evidence | `superpowers:verification-before-completion` |
| Product scope, PRD, issue slicing | `mattpocock:to-prd`, `mattpocock:to-issues` |
| Architecture and domain boundaries | `mattpocock:codebase-design`, `mattpocock:domain-modeling` |
| Debugging or review | `mattpocock:diagnosing-bugs`, `mattpocock:review` |

Declare every selected dependency in `workflow.json` and in the skill text that
needs it. If a dependency may be unavailable, instruct the agent to stop and name
the missing skill instead of silently continuing.

## Entry Skill Contract

An entry skill should:

1. Say it is the entry skill for the Omniskills workflow.
2. Name the approved input it needs before routing.
3. List required sub-skills in the same order as `workflow.json` steps.
4. Explain each `human_approval` gate and stop condition.
5. Tell the agent what to do when subagent dispatch or a dependency is missing.
6. Define the final combined output: decisions, accountable role, evidence,
   residual risk, and next action.

Keep the entry skill aligned with `workflow.json`; every `steps[].skill` should
have matching instructions or dependency text in the entry skill.

## Local Role Skill Contract

Use this shape for workflow-local phase or role skills:

```markdown
## Required Companion Skills

- `superpowers:brainstorming` for ...
- `mattpocock:review` for ...

If a companion skill is unavailable, stop and tell the coordinator which
dependency is missing.

## Operating Mode

1. Restate the input from the approved brief or previous handoff.
2. Make the role-specific decision or artifact.
3. State verification evidence or the verification bar.
4. Handoff only what the next role needs.

## Role Output

- Decision:
- Evidence:
- Risk:
- Handoff:
```

Role skills should not repeat the whole workflow. They should own one decision,
artifact, or verification lens and produce a handoff the coordinator can combine.

## Review Checklist

- The skill name matches its folder and manifest source.
- The description starts with `Use when...` and names concrete triggers.
- The skill uses exact dependency names such as `superpowers:brainstorming`.
- Approval gates are explicit; no phase advances on vague approval.
- Missing dependencies, missing dispatch, and blocked verification all stop.
- Outputs are structured enough to test with source-contract assertions.

## Common Mistakes

- Writing only broad advice like "use good engineering judgment".
- Choosing dependencies in prose but forgetting `workflow.json`.
- Letting an entry skill skip approval gates from the manifest.
- Making local role skills restate the whole workflow instead of a clear handoff.
- Hiding skipped roles or phases instead of naming why they are unnecessary.
