# Startup Team Omniskills Bundle

Use this team when one agent session needs a realistic startup operating bench
organized around a goal. It installs `$startup-goal` as the coordinator plus
role skills for CEO, CTO, product manager, web-design lead, engineering manager,
founding engineer, and QA lead, with the companion skills those roles expect.

The flow starts with `superpowers:brainstorming` as a one-question-at-a-time
requirements interview. The coordinator prepares role handoffs only after the
user approves the requirement brief, so vague startup asks become clear goals,
constraints, success criteria, and manual briefs before execution.

Install it from the repo root:

```bash
bun run dev -- install examples/teams/startup-team
```

Validate it while authoring:

```bash
bun run dev -- validate examples/teams/startup-team
```

Refresh the checked skill fingerprints after editing the bundled role skills:

```bash
bun run dev -- lock examples/teams/startup-team
```

## Model orchestration

The default install compiles the team's vendor-neutral `deep`, `standard`, and
`fast` assignments into global Codex and Claude profiles. Override model
candidates in `~/.omniskills/orchestration.json`.

Preview every skill and profile destination without writing:

```bash
bun run dev -- install examples/teams/startup-team --dry-run
```

Automatic role launch is disabled. The coordinator selects roles and prepares
manual briefs labeled `Prepared, not executed`, then stops. Run those briefs in
separate user-controlled tasks and return completed outputs to `$startup-goal`
for combination.

Installation still creates managed Codex and Claude profiles and preserves
model-role configuration. Profile generation does not launch a role or create
run state.

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
