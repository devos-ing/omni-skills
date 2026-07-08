# Startup Goal GetSuperpower

Use this workflow when one agent session needs a realistic startup operating
bench organized around a goal. It installs role entry skills for CEO, CTO,
product manager, engineering manager, founding engineer, and QA lead, plus the
companion Superpowers and Matt Pocock skills those roles expect.

The flow starts with `superpowers:brainstorming` as a one-question-at-a-time
requirements interview. The role bench should only run after the user approves
the requirement brief, so vague startup asks become clear goals, constraints,
success criteria, and role briefs before subagents fan out.

Install it from the repo root:

```bash
bun run dev -- install examples/workflows/startup-goal
```

Validate it while authoring:

```bash
bun run dev -- validate examples/workflows/startup-goal
```

Refresh the checked skill fingerprints after editing the bundled role skills:

```bash
bun run dev -- lock examples/workflows/startup-goal
```
