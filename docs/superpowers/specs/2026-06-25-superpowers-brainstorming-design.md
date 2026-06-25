# Superpowers Brainstorming Before Ponyrace Discussion

Date: 2026-06-25
Status: Approved design, pending written-spec review

## Problem

Ponyrace already has a requirement-first CLI flow: it normalizes the user's request, asks for missing details when the request is vague, drafts a goal contract, then runs the requirement court before worker execution. The current `/ponyrace` skill can trigger that CLI discussion directly, but it does not require the richer `superpowers:brainstorming` workflow before the role ponies discuss the requirement.

The requested feature is to run the actual Superpowers brainstorming skill before Ponyrace discussion so the task requirement is redefined, clarified, and approved by the human before the requirement court evaluates it. Ponyrace should also help users install `superpowers:brainstorming` when it is missing.

## Goals

- Make the installed `/ponyrace` skill invoke `superpowers:brainstorming` before `ponyrace ponyrace "<requirement>"`.
- Treat the approved Superpowers brainstorming output as the refined requirement sent into the Ponyrace CLI discussion.
- Preserve the existing Ponyrace human confirmation gate after role-bot discussion.
- Help users install the real `superpowers:brainstorming` skill through the existing skill installer surface.
- Keep setup and onboarding successful even when Superpowers is not installed, while printing actionable follow-up guidance.

## Non-Goals

- Do not reimplement the Superpowers brainstorming process inside the Ponytrail runtime.
- Do not make the Ponytrail core runtime spawn external agents for brainstorming.
- Do not bypass the requirement court, vote tally, judge summary, or final human confirmation.
- Do not fail `setup` or `onboard` only because the optional Superpowers skill is absent.
- Do not add a new package dependency for skill discovery.

## Architecture

The change should stay on two existing seams:

1. The bundled `ponyrace` skill owns chat-trigger behavior. Its instructions should require `superpowers:brainstorming` first, then call the CLI with the refined requirement after the brainstorming workflow reaches user approval.
2. The existing skill installer owns copying skills into agent homes. It should learn how to resolve `superpowers:brainstorming` from locally installed Superpowers plugin locations and report clear guidance when it cannot.

The Ponytrail runtime remains focused on local requirement discussion and should not know how to execute the Superpowers workflow. This keeps `src/runtimes/ponytrail` deterministic and avoids mixing interactive agent-skill orchestration into core goal drafting.

## Components

### Bundled `/ponyrace` Skill

Update `bundled-skills/ponyrace/SKILL.md` so its flow is:

1. Extract the requirement text after `/ponyrace`.
2. Invoke `superpowers:brainstorming` with that requirement.
3. Continue asking the user for clarification when the brainstorming skill needs input.
4. Stop if the brainstorming workflow has not reached user approval.
5. Run `ponyrace ponyrace "<approved refined requirement>"` after approval.
6. Preserve and report the existing CLI discussion output, including the detailed requirement and `Human confirmation: pending`.

The skill should clearly state that Superpowers approval is approval of the refined requirement before Ponyrace discussion, not approval to start implementation.

### Skill Source Resolution

Extend `resolveInstallSkillSource()` to support the source name `superpowers:brainstorming`. The installer should pass the selected `homeDir` into source resolution so tests and custom homes do not depend on the process home directory. Resolution should search known local Superpowers plugin cache paths under that home directory, such as plugin cache skill folders that contain `brainstorming/SKILL.md`.

When found, the resolver returns a path-based source named `superpowers-brainstorming`. This avoids colliding with unrelated local `brainstorming` skills and stays stable across install and update.

When missing, the resolver should throw an error that explains:

- `superpowers:brainstorming` was not found locally.
- The user should install or enable the Superpowers plugin first.
- They can rerun `ponyrace skills install superpowers:brainstorming --agents <agents> --home <home>` afterward.

### Setup And Onboarding

`setup` and `onboard` should continue installing the bundled `pony-trail` and `ponyrace` skills as required skills.

They should then attempt to install `superpowers:brainstorming` as an optional helper skill for the selected agent targets. If the source is available, print the normal install result and record local history. If unavailable, print a warning and the exact follow-up command, but still print the setup or onboarding completion message.

This makes fresh users aware of the new dependency without turning optional plugin availability into a project-creation failure.

## Data Flow

```text
User runs /ponyrace "raw request"
  -> bundled ponyrace skill invokes superpowers:brainstorming
  -> Superpowers workflow clarifies and presents a refined requirement
  -> user approves refined requirement
  -> ponyrace skill runs ponyrace ponyrace "<refined requirement>"
  -> Ponytrail CLI prepares goal discussion
  -> requirement court discusses, votes, and judge summarizes
  -> human confirmation remains pending
```

## Error Handling

- If `/ponyrace` has no requirement text, ask one concise question for the requirement.
- If `superpowers:brainstorming` is unavailable during chat use, tell the user how to install it and do not continue to the Ponyrace CLI discussion.
- If optional Superpowers install fails during `setup` or `onboard` because the source is missing, warn and continue.
- If optional Superpowers install fails for a filesystem or permission reason after the source is found, surface the error because the user may need to fix the target home directory.
- If brainstorming ends with unresolved questions, stop before Ponyrace discussion.

## Testing

- Add a bundled-skill test asserting the `ponyrace` skill requires `superpowers:brainstorming` before running the CLI discussion.
- Add installer tests for resolving `superpowers:brainstorming` from a local Superpowers-style skill path.
- Add installer tests for actionable missing-source guidance.
- Add CLI tests showing `setup` and `onboard` continue when optional Superpowers brainstorming is absent and print follow-up guidance.
- Keep the existing check command as final verification: `rtk bun run check`.

## Rollout Notes

This is a behavior change for future installed `/ponyrace` skills. Users with an older installed skill need to rerun `ponyrace skills update ponyrace` or rerun onboarding/setup to receive the new instructions. The optional Superpowers install should also be available through `ponyrace skills install superpowers:brainstorming`.
