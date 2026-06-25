# ponytrails Ponyrace

This directory stores Ponyrace requirement-first runtime files for AI agent work.

## Flow

1. Restart Codex or Claude after onboarding so it loads the installed `/ponyrace` skill.
2. Discuss a requirement in chat with `/ponyrace <request>`.
3. Let the configured review ponies discuss the direction and vote with the manifest approval rule.
4. Lock the goal only after the manifest approval rule passes and the human owner approves.
5. Use `/amend-goal` when execution discovers the goal must change.

CLI fallback: `ponyrace ponyrace "<request>"`.

Generated files under `.ponytrail/goals` should be treated as an append-only evidence trail.

## Local Extension Folders

- `.ponytrail/runtimes`: runtime-specific configuration and policies.
- `.ponytrail/plugins`: adapters for workers, evidence sources, and integrations.
- `.ponytrail/skills`: reusable judge or drafting capabilities.
