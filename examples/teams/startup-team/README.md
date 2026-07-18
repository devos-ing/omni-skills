# Startup Team Omniskills Bundle

Use this team when one agent session needs a realistic startup operating bench
organized around a goal. It installs `$startup-goal` as the coordinator plus
role skills for CEO, CTO, product manager, web-design lead, engineering manager,
founding engineer, and QA lead, with the companion skills those roles expect.

The flow starts with `superpowers:brainstorming` as a one-question-at-a-time
requirements interview. The coordinator launches selected internal subagents
only after the requirement brief is approved, so vague startup asks become
clear goals, constraints, success criteria, and bounded role packets before
execution.

Install it from the repo root:

```bash
bun run dev -- install examples/teams/startup-team
```

Validate it while authoring:

```bash
bun run dev -- validate examples/teams/startup-team
```

The checked-in `workflow.lock.json` fingerprints the complete local child graph
and every external locator. Refresh it whenever the coordinator, a child
workflow, or an external locator changes:

```bash
bun run dev -- lock examples/teams/startup-team
```

## Run one feature milestone at a time

Create `startup-goal-input.json` with the approved Goal Tunnel and ordered
milestones. For example:

```json
{
  "goalTunnel": {
    "goal": "Improve founder onboarding",
    "user": "A first-time founder",
    "problem": "The first useful action is unclear",
    "outcome": "The founder completes the first useful action",
    "scope": ["onboarding"],
    "nonGoals": ["billing"],
    "constraints": ["internal role execution requires a capable host"],
    "successCriteria": ["the first action is explicit and verified"],
    "assumptions": []
  },
  "milestones": [
    {
      "id": "first-action",
      "title": "Clarify the first action",
      "outcome": "The founder knows and completes the next action",
      "accountableRole": "product-manager",
      "dependencies": [],
      "acceptanceCriteria": ["the next action is explicit"]
    }
  ]
}
```

Use the loop commands to inspect and resume the active stage:

```bash
omniskill loop start examples/teams/startup-team --input-file startup-goal-input.json --json
omniskill loop status examples/teams/startup-team --latest --json
omniskill loop log examples/teams/startup-team --run <run-id> --type <expected-event> --metadata-file <packet.json> --json
omniskill loop advance examples/teams/startup-team --run <run-id> --json
```

The loop commands remain action-only; they inspect and persist lifecycle state
but do not launch a process. On a capable host, `$startup-goal` consumes the
action by launching selected installed profiles as internal subagents with
bounded stage packets. The user explicitly stops at plan approval before
implementation and feature acceptance after QA and evaluation. Between those
two gates, the accountable outcome role reconstructs the original expectations,
needs, wishes, and journey steps in a post-QA User Outcome Replay.

## Model orchestration

The default install compiles the team's vendor-neutral `deep`, `standard`, and
`fast` assignments into global profiles. The checked-in team also labels each
assignment with one of three model roles:

- `planning` for `$startup-goal`, strategy, product, design, architecture,
  management, founding-engineer framing, and support exploration.
- `implementation` for `mattpocock:implement` workspace-write execution.
- `verification` for `catalog:qa-lead`.

Use `$setup-model-routing` to configure global Codex CLI model and effort
selections for those labels. The skill drives these deterministic commands:

```bash
omniskill setup-model-routing --list-models --json
omniskill setup-model-routing \
  --planning-model <slug> --planning-effort <effort> \
  --implementation-model <slug> --implementation-effort <effort> \
  --verification-model <slug> --verification-effort <effort> \
  --dry-run --json
omniskill setup-model-routing \
  --planning-model <slug> --planning-effort <effort> \
  --implementation-model <slug> --implementation-effort <effort> \
  --verification-model <slug> --verification-effort <effort> \
  --apply --json
```

`--list-models` prints only Codex models that the signed-in identity exposes as
visible choices; hidden catalog entries are not valid setup candidates.

`startup-team` installs that setup skill from the checked-out repository via
`../../workflows/setup-model-routing/skills/setup-model-routing`, so local
dependency and install smoke tests do not require the public
`setup-model-routing` workflow alias to exist yet. The public
`setup-model-routing` workflow remains independently installable from
`examples/workflows/setup-model-routing`.

The setup command updates `~/.omniskills/orchestration.json`, managed Codex
profiles for installed labeled teams, and the matching installed workflow
records in one rollback-protected transaction. Schema `0.1` config files remain
valid; schema `0.2` stores the global `planning`, `implementation`, and
`verification` Codex selections. Codex profiles use those model-role selections;
Claude profiles continue to use their configured tiers.

Preview every skill and profile destination without writing:

```bash
bun run dev -- install examples/teams/startup-team --dry-run
```

When the host's agent-launch capability and the requested installed profile are
available, the coordinator launches the smallest selected role set as internal
subagents in the current task, waits for their Output Packets, and validates
evidence without prescribing their methods or conclusions. If either capability
is unavailable, it returns the same bounded brief labeled
`Prepared, not executed` and stops without claiming the role ran.

Installation still creates managed Codex and Claude profiles and preserves
model-role configuration. Profile generation does not itself launch a role or
create run state, and the removed public CLI dispatch path stays disabled.

Profiles are namespaced with `omniskills-startup-team-`. Reinstall updates only
unchanged managed profiles; removal keeps user-modified profiles and always
preserves the shared orchestration configuration.

The existing removal contract is unchanged:

```bash
omniskill remove startup-team --home ~ --dry-run
```

The skill cannot change the model of an already-running root session. Codex
receives a live profile smoke check in this repository; Claude output is
statically validated unless Claude Code is installed separately.
