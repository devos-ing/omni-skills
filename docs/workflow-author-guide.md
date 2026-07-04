# Create Your Own GetSuperpower

This guide shows the shortest path from an idea to a GetSuperpower that other
users can install.

Vocabulary:

- **GetSuperpower / 工作流包**: the folder users create, share, and install.
- **Skill Tree / 技能树**: the ordered flow inside the GetSuperpower.
- **Step / 步骤**: one node in the skill tree.
- **Skill / 技能**: one reusable capability used by a step.

Command note:

- In a cloned GetSuperpower repo, use `bun run dev -- <command>`.
- In another project, use `npx getsuperpower <command>`.

## Recommended: Call The Authoring Skill

Start here when you want an agent to help create the workflow and skills set.
Install the bundled authoring skill:

```bash
npx getsuperpower skills install creating-bundle-skills
```

Restart your agent app so it reloads the skill, then call it directly:

```text
$creating-bundle-skills create a GetSuperpower named support-triage that classifies support issues, plans the fix, and records evidence
```

The authoring skill should help you produce or review:

- `workflow.json`: the installable workflow manifest
- `README.md`: when to use the GetSuperpower and how to install it
- `skills/<workflow-name>/SKILL.md`: the entry skill users call
- `skills/<local-skill>/SKILL.md`: any local skills used by the workflow
- validation commands: `getsuperpower validate`, `getsuperpower deps`, and a
  local `install` smoke test

Use the rest of this guide as the checklist for what that skill should create.
If you are editing by hand, follow the same steps yourself.

## 1. Pick One Job

Start with one repeatable workflow, not a whole operating system.

Good examples:

- `support-triage`: classify a support issue, plan a fix, record evidence
- `release-review`: review release risk before implementation
- `bugfix-with-tests`: clarify a bug, plan the fix, verify regression coverage
- `real-engineering`: combine RTK, Ponytrail, Superpowers, and Matt Pocock skills

Use a lowercase name with hyphens:

```text
support-triage
```

## 2. Create The GetSuperpower

From the repo root:

```bash
bun run dev -- init support-triage --dir examples/workflows
```

This creates:

```text
examples/workflows/support-triage/
  workflow.json
  README.md
  skills/
    support-triage/
      SKILL.md
    custom-review/
      SKILL.md
```

`skills/support-triage/SKILL.md` is the entry skill: the one users call to run
the whole skill tree. If you used `$creating-bundle-skills`, ask it to keep this
entry skill aligned with the manifest before you validate.

## 3. Edit `workflow.json`

Open `examples/workflows/support-triage/workflow.json`.

Each workflow has two important lists:

- `skills`: the skills the workflow needs
- `steps`: the skill tree order a user or agent should follow

Example:

```json
{
  "schemaVersion": "0.1",
  "name": "support-triage",
  "version": "0.1.0",
  "description": "Clarify, review, plan, and preserve evidence for support fixes.",
  "skills": [
    { "source": "./skills/support-triage" },
    { "source": "superpowers:brainstorming", "repo": "obra/superpowers" },
    { "source": "./skills/support-review" },
    { "source": "superpowers:writing-plans", "repo": "obra/superpowers" }
  ],
  "steps": [
    {
      "id": "shape",
      "title": "Clarify the support issue",
      "skill": "superpowers:brainstorming",
      "gate": "human_approval"
    },
    {
      "id": "support-review",
      "title": "Review customer impact and risk",
      "skill": "./skills/support-review",
      "gate": "human_approval"
    },
    {
      "id": "plan",
      "title": "Write the fix plan",
      "skill": "superpowers:writing-plans"
    }
  ]
}
```

Keep every `steps[].skill` value exactly equal to one of the `skills[].source`
values.

For a skill installed from the Skills CLI, keep `source` as the original skill
name used by workflow steps, and set `repo` to the package passed to
`npx skills add`, such as `obra/superpowers` or `mattpocock/skills`.

The entry skill itself belongs in `skills[]`, but it does not need its own step.
It is the callable wrapper that instructs the agent to run the declared steps.

## 4. Edit The Entry Skill

Open:

```text
examples/workflows/support-triage/skills/support-triage/SKILL.md
```

Keep its required sub-skills in the same order as `workflow.json` steps. This is
what lets a user call one skill and have the agent follow the N-skill workflow.

The generated entry skill should say what happens when a dependency is missing:
stop, name the missing skill, and tell the user which install command to run.

Use this checklist when reviewing the entry skill:

- It says it is the entry skill for this GetSuperpower.
- It lists every required sub-skill in step order.
- It tells the agent to stop if a required sub-skill is missing.
- It keeps human approval gates explicit when a workflow phase needs approval.
- It does not claim deterministic tool execution; it orchestrates required
  instructions and skills.

## 5. Add Local Skill Guidance

If your workflow has its own local skill, create or rename a skill folder:

```text
examples/workflows/support-triage/skills/support-review/SKILL.md
```

Example:

```markdown
---
name: support-review
description: "Review support fixes for customer impact, urgency, and rollback risk."
---

# Support Review

Use this skill when a support issue needs a fix plan.

Check:

- affected users or accounts
- severity and urgency
- reproduction evidence
- rollback path
- customer-visible acceptance criteria
```

Then update `workflow.json` to use:

```json
{ "source": "./skills/support-review" }
```

## 6. Validate The GetSuperpower

Run:

```bash
bun run dev -- validate examples/workflows/support-triage
```

Expected output:

```text
GetSuperpower valid: support-triage@0.1.0
Steps: 4
Skills: 5
```

## 7. Inspect And Test Local Install

Show the dependencies before installing:

```bash
bun run dev -- deps examples/workflows/support-triage
```

Install it into a project:

```bash
bun run dev -- install examples/workflows/support-triage
```

Then list installed GetSuperpowers:

```bash
bun run dev -- list
```

You should see:

```text
support-triage 0.1.0
```

Restart your agent app after installing, so Codex, Claude, Cursor, or GitHub
Copilot reloads the installed skills.

After restart, the user can invoke the entry skill, for example:

```text
$support-triage fix this support issue
```

## 8. Share It On GitHub

GetSuperpower lives at:

```text
git@github.com:0xroylee/getsuperpower.git
```

Checked-in examples under `examples/workflows` can be installed by folder alias:

```bash
npx getsuperpower@latest install support-triage
```

That alias resolves to:

```bash
npx getsuperpower@latest install 'https://github.com/0xroylee/getsuperpower.git#examples/workflows/support-triage'
```

If you have write access:

```bash
git switch -c codex/add-support-triage-workflow
git add examples/workflows/support-triage
git commit -m "docs: add support triage workflow example"
git push origin codex/add-support-triage-workflow
```

If you do not have write access, fork the repo on GitHub, push the branch to
your fork, then open a pull request into `0xroylee/getsuperpower`.

Users can also install a workflow directly from a public git repository when
the repository root contains `workflow.json`:

```bash
npx getsuperpower install https://github.com/acme/support-triage.git
```

If the workflow lives in a subdirectory, add the workflow path as a URL
fragment:

```bash
npx getsuperpower install 'https://github.com/acme/workflows.git#examples/workflows/support-triage'
```

Before opening the pull request, run:

```bash
rtk bun run check
```

In the pull request, include:

- what workflow you added
- who should use it
- the command you ran to validate it
- whether it includes local skills

## 9. GetSuperpower Review Checklist

Before sharing, check:

- The workflow name is lowercase and hyphenated.
- `workflow.json` passes `getsuperpower validate`.
- The entry skill exists at `skills/<workflow-name>/SKILL.md`.
- The entry skill lists required sub-skills in step order.
- Every step references a declared skill source.
- Local skills have a `SKILL.md` with frontmatter.
- The README explains when to use the workflow.
- The workflow is narrow enough to run repeatedly.

## Example: Combine RTK, Ponytrail, Superpowers, And Matt Pocock Skills

The checked-in `real-engineering` workflow shows how to combine local workflow
guidance with external skill packs:

```bash
bun run dev -- validate examples/workflows/real-engineering
```

It uses:

- `./skills/rtk-command-discipline` for repo command rules
- `pony-trail` for file-change snapshots
- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `mattpocock:grill-with-docs`
- `mattpocock:tdd`
- `mattpocock:codebase-design`
- `mattpocock:diagnosing-bugs`

When installing that workflow, GetSuperpower automatically uses the Skills CLI
to fetch missing `mattpocock:*` dependencies. If that automatic bootstrap fails,
run the same package install through GetSuperpower and retry:

```bash
bun run dev -- skills install mattpocock/skills
```
