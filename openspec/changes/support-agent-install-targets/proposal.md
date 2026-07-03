# Proposal: Support Advertised Skill Install Targets

## Summary

Make the GetSuperpower CLI's `skills install` and `skills update` target
surface match the agents the product already advertises: Claude, Codex, Cursor,
opencode, and GitHub Copilot.

The current installer supports `claude`, `codex`, `cursor`, and `copilot`.
Docs and landing copy also mention opencode, but `--agents opencode` is rejected
today.

## Motivation

The README says GetSuperpower works with Claude, Codex, opencode, Cursor, and
GitHub Copilot. A user who trusts that copy should be able to run one CLI
command and have a selected skill land in the right agent locations.

This matters most for explicit skills commands:

- `getsuperpower skills install <skill>` should accept the same target names.
- `getsuperpower skills update <skill>` should refresh the same target names.
- `opencodex`, from the user request, should not create a separate target
  layout; it should behave as a friendly alias for the canonical `opencode`
  target.
- GitHub Copilot should remain user-facing as "GitHub Copilot" while the CLI
  accepts the shorter `copilot` target name.

## Scope

In scope:

- Add `opencode` as a canonical skill install target.
- Accept `opencodex` as an alias for `opencode`.
- Keep accepting `copilot` for GitHub Copilot.
- Make skill install and skill update help text list all supported target names.
- Decide and document the target paths for each advertised agent.
- Add focused tests for parsing, installation destinations, update behavior,
  help text, and unknown-agent failures.
- Add a scratch-home smoke check proving the CLI writes the expected files for
  all advertised targets.

Out of scope:

- Adding live integrations with any agent application.
- Changing workflow install or clone defaults.
- Changing workflow manifest semantics.
- Reintroducing paused Pony Trail history, revert, or prehook public commands.
- Adding hosted distribution, registry browsing, or GUI setup flows.
- Changing external Skills CLI behavior beyond passing the selected target list
  through the existing install seam.

## Proposed Design Direction

Use the existing `SkillInstallAgent` and target-strategy table as the seam.
Extend it with an `opencode` directory target that writes to the shared
`.agents/skills/<skill>` location, matching the current shared-agent convention
used by Codex primary installs and GitHub Copilot.

Normalize aliases at parse time:

- `opencode` -> `opencode`
- `opencodex` -> `opencode`
- `copilot` -> `copilot`
- `github-copilot` -> `copilot`
- `githubcopilot` -> `copilot`

Return the normalized target names from `parseSkillInstallAgents` so downstream
code does not need to understand aliases. Keep duplicate shared destinations
deduplicated by the existing destination-status map, so an explicit install or
update that includes `codex`, `opencode`, and `copilot` does not copy the same
skill folder three separate times.

Prehook support should stay limited to existing hook-capable targets. Cursor has
no prehook support today, and opencode should not gain hook behavior until the
repo has an explicit opencode hook contract.

## Acceptance Criteria

- `getsuperpower skills install <skill> --agents claude,codex,cursor,opencode,copilot`
  succeeds and writes the expected target files under an isolated `--home`.
- `getsuperpower skills install <skill> --agents opencodex` succeeds and reports
  an `opencode` target result.
- `getsuperpower skills install <skill> --agents github-copilot` succeeds and
  reports a `copilot` target result.
- `getsuperpower skills update <skill> --agents claude,codex,cursor,opencode,copilot`
  refreshes those target files without requiring workflow commands.
- Help text for skill install and skill update names the supported target
  list clearly.
- Unknown agent values still fail with a clear `Unknown skill install agent`
  error.
- Docs and architecture notes describe the supported targets and shared
  destination behavior.
- `rtk bun run check` passes before delivery.

## Open Questions For Review

- Should `opencode` use the shared `.agents/skills` directory for this pass, as
  proposed, or do you want a separate opencode-specific path if the app expects
  one?
- Should `github-copilot` and `githubcopilot` aliases be included now, or should
  `copilot` remain the only accepted GitHub Copilot CLI spelling?
