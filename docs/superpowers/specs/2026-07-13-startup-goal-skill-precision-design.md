# Startup Goal Skill Precision

## Goal

Make the bundled `startup-goal` workflow skills shorter and more precise without
changing their roles, dependencies, approval gates, or verification standards.

## Scope

- Simplify the `startup-goal` entry skill and its seven bundled role skills.
- Keep the manifest step order and installed skill set unchanged.
- Update contract tests only where wording anchors change.
- Regenerate `workflow.lock.json` after skill edits.

## Contract

The entry skill will use five phases:

1. Clarify one material unknown at a time.
2. Present and obtain approval for a requirement brief.
3. Select the smallest safe role set and justify skipped roles.
4. Dispatch one subagent per selected role with an explicit brief.
5. Combine role outputs into an accountable decision log and next action.

Every run must still show active roles, skipped roles, completed outputs, and
verification evidence. If subagent dispatch is unavailable, prepare the role
briefs and stop.

Each role skill will use the same compact structure:

- **Use when:** the decision boundary for invoking the role.
- **Companions:** required supporting skills and missing-dependency behavior.
- **Do:** a short ordered checklist containing only role-specific work.
- **Return:** `Decision` or `Change`, `Evidence`, `Risk`, and `Handoff`.

## Constraints

- Preserve the requirements approval gate and route approval gate.
- Preserve lazy routing and visible processing.
- Preserve web-design motion review and its `Approve` or `Block` release verdict.
- Preserve founding-engineer and QA verification-before-completion requirements.
- Do not add roles, dependencies, runtime behavior, or public CLI commands.

## Verification

Run the focused workflow bundle tests, validate and inspect dependencies for the
workflow, regenerate its lockfile, then run `rtk bun run check`.
