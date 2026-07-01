---
name: creating-bundle-skills
description: Use when creating or editing a GetSuperpower workflow bundle, bundle skill, entry skill, orchestrator skill, skill tree, or workflow that composes multiple agent skills into one callable skill.
---

# Creating Bundle Skills

## Overview

Use this skill to create a GetSuperpower bundle skill: one entry skill users call, plus a `workflow.json` that installs and validates the required sub-skills.

Core distinction:

- **GetSuperpower**: the installable workflow bundle folder.
- **Entry skill**: the callable `SKILL.md` that tells the agent to use N sub-skills in order.
- **Sub-skill**: one dependency such as `superpowers:brainstorming`, `pony-trail`, or `mattpocock:tdd`.

An entry skill cannot guarantee tool-level function calls in every agent runtime. It can require skill use through instructions. GetSuperpower makes that reliable by installing dependencies, validating the manifest, and recording the workflow.

## Workflow

1. Choose one repeatable job and name it with lowercase hyphen-case.
2. Create or update the GetSuperpower folder with `workflow.json`, `README.md`, and `skills/`.
3. Create one entry skill under `skills/<workflow-name>/SKILL.md`.
4. Add every required sub-skill to `workflow.json` `skills[]`.
5. Add ordered workflow phases to `workflow.json` `steps[]`; each `steps[].skill` must exactly match a declared `skills[].source`.
6. Keep the entry skill's required sub-skill list in the same order as `workflow.json` steps.
7. Run `getsuperpower validate`, then `getsuperpower deps`, then a local install smoke test.

## Entry Skill Template

Use this shape for `skills/<workflow-name>/SKILL.md`:

```markdown
---
name: workflow-name
description: Use when running the workflow-name GetSuperpower workflow or skill tree.
---

# workflow-name GetSuperpower

This is the entry skill for the workflow-name GetSuperpower.

## Required Sub-Skills

Before doing workflow work, load/use these skills in order:

1. superpowers:brainstorming
2. ./skills/custom-review
3. superpowers:writing-plans
4. pony-trail

If any required sub-skill is unavailable, stop and tell the user the missing skill and install command.

## Flow

1. Shape the request.
2. Run the bundle-specific review.
3. Write the implementation plan.
4. Record evidence and rollback context.
5. Verify before reporting completion.
```

## Manifest Rules

Add the entry skill itself to `skills[]` so installation puts the callable skill on the user's machine:

```json
{
  "skills": [
    { "source": "./skills/workflow-name" },
    { "source": "superpowers:brainstorming" },
    { "source": "./skills/custom-review" },
    { "source": "superpowers:writing-plans" },
    { "source": "pony-trail" }
  ]
}
```

Do not add a step for the entry skill. Steps describe the workflow the entry skill orchestrates.

## Quality Bar

- Keep the workflow narrow enough to repeat.
- Make missing dependencies explicit instead of silently skipping them.
- Prefer exact skill source names over prose labels.
- Keep `README.md`, `workflow.json`, and the entry skill aligned.
- Validate with `getsuperpower validate <path>` before sharing.

## Common Mistakes

- Putting only `workflow.json` in the bundle: users still need one skill to call.
- Using different strings for `steps[].skill` and `skills[].source`: validation should reject this.
- Writing "use good engineering practices" instead of naming required sub-skills.
- Claiming the entry skill auto-executes tools deterministically: it orchestrates by required instructions, while the CLI handles installation and validation.
