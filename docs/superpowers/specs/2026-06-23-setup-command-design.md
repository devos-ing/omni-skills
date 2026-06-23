# Ponytrail Setup Command Design

## Goal

Add `ponytrail setup` as an interactive setup wizard for Ponytrail projects.
The command configures the local bot team, manifest, and agent skills. It does
not ask for a task requirement and does not run a pony race. Task discussion
continues to start through `ponytrail ponyrace "<requirement>"`.

## User Experience

`ponytrail setup` guides a first-time user through bot setup:

1. Ask for the workspace name.
2. Ask how many bots should participate in the requirement discussion.
3. For each bot, ask for id, display name, role or panel, instruction, model id,
   model name, and whether the bot votes.
4. Ask for the approval rule. The default is over 60 percent of voting bots,
   rounded up.
5. Ask which agent targets should receive the bundled skills. The default is
   `codex,claude,cursor`.
6. Write `.ponytrail/manifest.json` and supporting `.ponytrail` folders.
7. Install both bundled skills: `pony-trail` and `ponyrace`.
8. Print the manifest path, installed targets, and the next command:
   `ponytrail ponyrace "your requirement"`.

The default setup should remain fast. If the user presses Enter through the
wizard, Ponytrail creates the standard Product, Project, Senior Engineer, and
Testing voting bots with the default requirement judge and drafting bots.

## Scope

In scope:

- Add a new `setup` CLI command.
- Keep `onboard` available for the current lightweight default setup path.
- Reuse the existing onboarding file writer where possible.
- Add a manifest customization path for bot and model definitions.
- Reuse the existing bundled skill installer and local skill history snapshots.
- Support Codex, Claude, and Cursor as the default setup install targets.
- Add tests for command registration, manifest creation, skill installation, and
  default approval-rule calculation.

Out of scope:

- Asking for a task requirement during setup.
- Running worker agents.
- Running `ponyrace` automatically.
- Adding live Codex, Claude, Cursor, or network side effects outside the skill
  install seam.
- Removing or replacing `onboard`.

## Architecture

`src/cli.ts` stays thin. It owns Commander command registration, interactive
prompts, output text, and calls into runtime/plugin seams.

`src/runtimes/ponytrail/` owns manifest construction and validation. The setup
command should not hand-build unchecked JSON in the CLI. Add a runtime helper
that accepts a workspace name, bot setup answers, and approval rule answers,
then returns a manifest parsed by `ManifestSchema`.

`src/plugins/` continues to own agent skill installation. Setup installs
`pony-trail` and `ponyrace` by calling the existing install path twice, with
local Ponytrail history around each write.

## Data Flow

```text
ponytrail setup
  -> prompt for workspace name
  -> prompt for bot roster and model ids
  -> prompt for approval rule
  -> create .ponytrail workspace files
  -> write validated manifest
  -> install pony-trail skill
  -> install ponyrace skill
  -> print next ponyrace command
```

The manifest should contain:

- Required built-in bots for brainstorming, drafting, and judging.
- User-defined discussion bots.
- A `models` entry for every selected model id.
- A deliberation decision rule whose voters match the bots marked as voting.
- `defaultGoalTemplate.approvalRule.goalDirectionPanel` aligned with the same
  voters and required approval count.

## Approval Rule

The default rule is "over 60 percent of voting bots must approve." The computed
approval count is:

```text
floor(voters * 0.6) + 1
```

Examples:

- 3 voters require 2 approvals.
- 4 voters require 3 approvals.
- 5 voters require 4 approvals.

The CLI offers two approval-rule choices: use the default over-60-percent rule
or enter a custom approval count. Custom counts below 1 or above the number of
voting bots are rejected before the manifest is written.

## Error Handling

- If a prompt is cancelled, exit with a clear cancellation error and avoid
  writing partial setup output where practical.
- If zero voting bots are configured, reject the setup before writing the
  manifest.
- If a bot references an empty model id, reject the setup before writing the
  manifest.
- If skill installation fails after manifest creation, print the manifest path
  and fail the command so the user can rerun setup or `skills install`.
- Manifest validation failures should surface as setup errors rather than
  writing invalid JSON.

## Testing

Add focused Bun tests:

- `setup` appears in CLI command registration.
- Default setup creates the standard discussion bot roster and writes a valid
  `.ponytrail/manifest.json`.
- Custom setup can create a different number of voting bots.
- The default over-60-percent rule produces 3 approvals for 4 voters and 4
  approvals for 5 voters.
- Setup installs both `pony-trail` and `ponyrace` for Codex, Claude, and Cursor
  when using the default target list.
- Setup does not run `ponyrace` and does not ask for a task requirement.

Full verification after implementation should run:

```bash
rtk bun run check
```

CLI smoke should use a scratch directory under `work/`, for example:

```bash
rtk bun run dev -- setup --dir work/smoke-setup --name "Smoke Setup" --home work/smoke-setup --agents codex,claude,cursor
rtk bun run dev -- bots --manifest work/smoke-setup/.ponytrail/manifest.json
```
