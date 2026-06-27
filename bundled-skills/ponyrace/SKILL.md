---
name: ponyrace
description: Use when the user invokes /ponyrace, asks to run a pony race, wants role ponies to discuss whether a requirement direction matches their request, or wants Ponyrace's CLI requirement discussion before implementation.
---

# Ponyrace

## Overview

Run Superpowers brainstorming first, then run Ponyrace's CLI requirement
discussion, then write the implementation plan with Superpowers writing-plans
before any implementation begins. The skill makes `/ponyrace ...` a chat
trigger for an approved, refined requirement: `superpowers:brainstorming` owns
redefining the task requirement with the human, and the `ponyrace ponyrace` CLI
remains the source of truth for role-pony discussion, vote tallying, Judge
summary, detailed requirement, and human confirmation.

Core principle: the human approves the refined requirement before Ponyrace
discussion starts, separately confirms the Ponytrail requirement direction after
the court reports, and then separately approves the written implementation plan
before any implementation action or file edit.

Superpowers approval is not worker execution approval.
Choosing an approach, selecting an option number, or saying "let's do it"
after alternatives are presented is direction approval only; it is not approval
to edit files unless the written implementation plan has already been shown and
explicitly approved.
Implementation and file edits begin only after explicit human approval of the written implementation plan.

Installed skill copies are refreshed through `ponyrace skills update` or
reinstall.

## Flow

1. Extract the requirement text after `/ponyrace`; if the request text is
   missing, ask the user for the requirement in one concise question.
2. Invoke `superpowers:brainstorming` with the extracted requirement before
   running the Ponyrace CLI.
3. If `superpowers:brainstorming` or `superpowers:writing-plans` is unavailable,
   stop and tell the user to run the missing command, restart their agent IDE,
   and retry `/ponyrace`:
   - `ponyrace skills install superpowers:brainstorming --agents codex,claude,cursor --home ~`
   - `ponyrace skills install superpowers:writing-plans --agents codex,claude,cursor --home ~`
4. Follow the Superpowers brainstorming workflow until the human approves the
   refined requirement. If the workflow needs more human input or has not
   reached approval, keep working in that workflow and do not run Ponyrace yet.
5. Run the Ponyrace CLI discussion with
   `ponyrace ponyrace "<approved refined requirement>"`.
6. If the user gives a manifest path, pass it with `--manifest <path>` instead
   of appending it to the requirement text.
7. Ponyrace uses local deterministic review by default. Do not pass
   `--research` unless the user explicitly approves worker-backed research,
   because it can send the requirement plus private repo, tool, and
   dirty-worktree context through the selected worker CLI/model. If the user
   approves that path and names a worker, pass `--research --worker <id>`;
   otherwise pass `--research` and use the manifest default worker.
8. Preserve the important CLI output when reporting back:
   - pony discussion lines
   - visible thinking transcript
   - evidence lines, when present
   - Judge summary
   - approval tally
   - detailed requirement
   - Markdown report path, when the CLI writes one
   - `Human confirmation: pending`
9. Stop after the discussion and ask for explicit human approval of the
   requirement direction before planning implementation.
10. After the human approves the requirement direction, invoke
    `superpowers:writing-plans` and write the implementation plan through that
    skill's workflow.
11. Stop after the implementation plan and show the plan. Ask for explicit
    human approval of the written implementation plan. Short replies such as
    `1`, `option 1`, `yes to the direction`, `sounds good`, `approve the
    requirement`, or `continue` before this point approve only the requirement
    direction, not file edits.
12. Begin implementation only after explicit human approval of the written
    implementation plan.

## Guardrails

- Do not run the Ponyrace CLI before `superpowers:brainstorming` reaches human
  approval for the refined requirement.
- Do not reimplement Superpowers brainstorming in this skill.
- Do not reimplement Superpowers writing-plans in this skill.
- Do not reimplement voting in the skill.
- Do not bypass the CLI requirement discussion.
- Do not start worker implementation from this skill.
- Do not treat Superpowers brainstorming approval, 3-of-4 court approval, any
  bot vote, or human confirmation of the requirement direction as approval to
  edit files.
- Do not treat approach selection, option selection, or approval of a proposed
  direction as approval to edit files. If no written implementation plan has
  been presented and explicitly approved, stop and write the plan first.
- Do not take any implementation action or file edit before explicit human
  approval of the written implementation plan.
- Do not edit installed skill copies as part of changing the bundled source.
  Installed skill copies are refreshed through `ponyrace skills update` or
  reinstall.
- Do not call worker-backed pony review a guarantee of correctness; it is an
  explicit research opt-in where each pony runs through the selected worker CLI
  and must return visible evidence before approval.
- If `ponyrace` is unavailable and this is not the local Ponyrace repo, say the
  CLI is unavailable and ask the user how they want to run it.
