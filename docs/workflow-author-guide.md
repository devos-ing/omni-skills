# Create Your Own Omniskills Workflow

This guide shows the shortest path from an idea to an Omniskills workflow that other
users can install.

Vocabulary:

- **Omniskills workflow / 工作流包**: the folder users create, share, and install.
- **Skill Tree / 技能树**: the ordered flow inside the Omniskills workflow.
- **Step / 步骤**: one node in the skill tree.
- **Skill / 技能**: one reusable capability used by a step.

Command note:

- In a cloned Omniskills repo, use `bun run dev -- <command>`.
- In another project, use `npx omniskill@latest <command>`.

## Recommended: Call The Authoring Skill

Start here when you want an agent to help create the workflow and skills set.
Install the bundled authoring skill:

```bash
npx omniskill@latest skills install creating-bundle-skills
```

Restart your agent app so it reloads the skill, then call it directly:

```text
$creating-bundle-skills create an Omniskills workflow named support-triage that classifies support issues, plans the fix, and records evidence
```

The authoring skill should help you produce or review:

- `workflow.json`: the installable workflow manifest
- `workflow.lock.json`: generated skill fingerprints for the workflow's local
  and external skill sources
- `README.md`: when to use the Omniskills workflow and how to install it
- `skills/<workflow-name>/SKILL.md`: the entry skill users call
- `skills/<local-skill>/SKILL.md`: any local skills used by the workflow
- validation commands: `omniskill validate`, `omniskill deps`, and a
  local `install` smoke test

When the workflow shape is already clear and you only need help writing the
entry skill, local role skills, dependency choices, gates, or handoff contracts,
install and invoke the narrower prompt-writing helper:

```bash
npx omniskill@latest skills install writing-workflow-skills
```

Use the rest of this guide as the checklist for what that skill should create.
If you are editing by hand, follow the same steps yourself.

## 1. Pick One Job

Start with one repeatable workflow, not a whole operating system.

Good examples:

- `cto`: architecture, technical risk, and engineering strategy
- `product-manager`: discovery, PRD, and issue slicing
- `founding-engineer`: implement, test, debug, review, and verify
- `support-triage`: classify a support issue and plan a fix

Use a lowercase name with hyphens:

```text
support-triage
```

## 2. Create The Omniskills Workflow

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
    {
      "source": "superpowers:brainstorming",
      "repo": "https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99"
    },
    { "source": "./skills/support-review" },
    {
      "source": "superpowers:writing-plans",
      "repo": "https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99"
    }
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
name used by workflow steps. Set `repo` to an exact commit
URL accepted by `npx skills add`, such as
`https://github.com/obra/superpowers/tree/d884ae04edebef577e82ff7c4e143debd0bbec99`. Do not publish a workflow
with a floating branch or bare repository reference.

The entry skill itself belongs in `skills[]`, but it does not need its own step.
It is the callable wrapper that instructs the agent to run the declared steps.

### Generate `workflow.lock.json`

After editing `workflow.json` or any local skill in `skills/`, refresh the lock
file:

```bash
bun run dev -- lock examples/workflows/support-triage
```

The lock file records deterministic hashes for local skill contents and the
declared locator for external skills. It does not snapshot a moving upstream
branch, so external `repo` values must already point at exact commits. Commit
the lock with the workflow so reviewers can see when the skill
tree changed.

### Optional Loop Runtime

A workflow can opt into resumable, action-only loop state by declaring a
generated loop runner path in `workflow.json`:

```json
{
  "loop": {
    "script": "./loop.mjs",
    "state": "global",
    "execution": "action-only"
  },
  "skills": [{ "source": "./skills/support-triage", "entry": true }],
  "steps": [
    {
      "id": "shape",
      "title": "Clarify the support issue",
      "skill": "superpowers:brainstorming",
      "instruction": "Clarify the issue and wait for explicit approval."
    }
  ]
}
```

Looped workflows must mark exactly one local skill as `entry: true`. Put the
exact phase prompt in `steps[].instruction`; `omniskill loop status
<source> --json` returns that instruction.

`loop.script` is an install output path, not a required source file. During
install, Omniskills copies `workflow.json`, writes generated
`loop.metadata.json`, and writes a generated `loop.mjs` bridge into the
installed entry skill folder only. The bridge delegates back to the
Omniskills CLI, where the generic loop runtime lives.

Agents should operate looped workflows with:

```bash
omniskill loop start <source> --json
omniskill loop status <source> --latest --json
omniskill loop log <source> --run <id> --type phase_result --message "..."
omniskill loop advance <source> --run <id> --json
omniskill loop summary <source> --run <id> --json
```

The generated `loop.mjs` wrapper remains a Node compatibility fallback after
install. It requires the `omniskill` CLI on `PATH` or an `OMNISKILL_BIN`
environment override.

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

- It says it is the entry skill for this Omniskills workflow.
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

## 6. Validate The Omniskills Workflow

Run:

```bash
bun run dev -- lock examples/workflows/support-triage
bun run dev -- validate examples/workflows/support-triage
```

Expected output:

```text
Omniskills valid: support-triage@0.1.0
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

Then list installed Omniskills workflows:

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

The Omniskills workflow lives at:

```text
git@github.com:devos-ing/omni-skills.git
```

Checked-in examples under `examples/workflows` can be installed by folder alias:

```bash
npx omniskill@latest install support-triage
```

That alias resolves to:

```bash
npx omniskill@latest install 'https://github.com/devos-ing/omni-skills.git#examples/workflows/support-triage'
```

If you have write access:

```bash
git switch -c codex/add-support-triage-workflow
git add examples/workflows/support-triage
git commit -m "docs: add support triage workflow example"
git push origin codex/add-support-triage-workflow
```

If you do not have write access, fork the repo on GitHub, push the branch to
your fork, then open a pull request into `devos-ing/omni-skills`.

Users can also install a workflow directly from a public git repository when
the repository root contains `workflow.json`:

```bash
npx omniskill@latest install https://github.com/acme/support-triage.git
```

If the workflow lives in a subdirectory, add the workflow path as a URL
fragment:

```bash
npx omniskill@latest install 'https://github.com/acme/workflows.git#examples/workflows/support-triage'
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

## 9. Omniskills Review Checklist

Before sharing, check:

- The workflow name is lowercase and hyphenated.
- `workflow.lock.json` exists and was regenerated after the latest skill edit.
- `workflow.json` passes `omniskill validate`.
- Every external `repo` points at an exact commit.
- The entry skill exists at `skills/<workflow-name>/SKILL.md`.
- The entry skill lists required sub-skills in step order.
- Every step references a declared skill source.
- Local skills have a `SKILL.md` with frontmatter.
- The README explains when to use the workflow.
- The workflow is narrow enough to run repeatedly.

## Example: Startup Role Catalog

The checked-in startup role workflows show the preferred public example style:
real job roles with one callable entry skill and explicit companion skills.

```bash
bun run dev -- validate examples/teams/startup-team
bun run dev -- deps examples/teams/startup-team
```

Install individual roles when you want one job lane:

```bash
bun run dev -- install examples/workflows/cto
bun run dev -- install examples/workflows/product-manager
bun run dev -- install examples/workflows/founding-engineer
```

Install `startup-team` when you want the full role bench. Invoke its
`$startup-goal` coordinator to clarify, route, dispatch, and combine the work:

```bash
bun run dev -- install examples/teams/startup-team
```

A team coordinator is one declared local entry skill. Every `members[]` source
must be declared in `skills[]` and resolve to a child workflow with exactly one
local entry skill. Member workflow dependencies are expanded recursively; only
the root team install record is written. Local helper skills may still be
declared, but they are not team members.

## Compatibility Example: Combine RTK, Superpowers, And Matt Pocock Skills

The checked-in `real-engineering` workflow shows how to combine local workflow
guidance with external skill packs. It remains available as a compatibility demo
while the startup role catalog becomes the primary example set:

```bash
bun run dev -- validate examples/workflows/real-engineering
```

It uses:

- `./skills/rtk-command-discipline` for repo command rules
- `superpowers:brainstorming`
- `superpowers:writing-plans`
- `superpowers:verification-before-completion`
- `mattpocock:grill-with-docs`
- `mattpocock:tdd`
- `mattpocock:codebase-design`
- `mattpocock:diagnosing-bugs`

When installing that workflow, Omniskills automatically uses the Skills CLI
to fetch missing `mattpocock:*` dependencies. If that automatic bootstrap fails,
run the same package install through Omniskills and retry:

```bash
bun run dev -- skills install mattpocock/skills
```
