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
