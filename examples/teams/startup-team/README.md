# Startup Team Omniskills Bundle

Use this team when one agent session needs a realistic startup operating bench
organized around a goal. It installs `$startup-goal` as the coordinator plus
role skills for CEO, CTO, product manager, web-design lead, engineering manager,
founding engineer, and QA lead, with the companion skills those roles expect.

The flow starts with `superpowers:brainstorming` as a one-question-at-a-time
requirements interview. The role bench should only run after the user approves
the requirement brief, so vague startup asks become clear goals, constraints,
success criteria, and role briefs before subagents fan out.

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

After installation, preflight a read-only role without creating run state:

```bash
omniskill dispatch startup-team --role catalog:cto --task "Review the architecture" --runtime codex --home ~ --dry-run --json
```

Remove `--dry-run` to execute. An implementation role with `workspace-write`
access also requires `--approve-workspace-write`. Dispatch receipts are stored
under `~/.omniskills/runs/<workflow>/<run-id>/` with the request, full candidate
plan, append-only attempts, and final receipt. `launch_configured` proves the
requested model and effort were passed to the runtime; `runtime_reported` is
stronger evidence emitted by a runtime event.

Resume a structured consultation without changing the verified profile:

```bash
omniskill dispatch resume <run-id> --decision continue --message "Keep the compatibility adapter" --home ~
```

Codex CLI execution is supported. Claude profiles are generated and validated,
but Claude dispatch execution is currently unsupported and fails closed.

Profiles are namespaced with `omniskills-startup-team-`. Reinstall updates only
unchanged managed profiles; removal keeps user-modified profiles and always
preserves the shared orchestration configuration.

The existing removal contract is unchanged:

```bash
omniskill remove startup-team --home ~ --dry-run
```

The skill cannot change the model of an already-running root session. Fallback
and consultation are visible orchestration protocols, not provider-level
guarantees. Codex receives a live smoke check in this repository; Claude output
is statically validated unless Claude Code is installed separately.
