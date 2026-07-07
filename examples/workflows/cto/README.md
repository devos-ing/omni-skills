# CTO GetSuperpower

Use this workflow when an agent should act as a startup CTO: inspect architecture,
surface technical risk, and turn product direction into engineering strategy.

Install it from the repo root:

```bash
bun run dev -- install examples/workflows/cto
```

Validate it while authoring:

```bash
bun run dev -- validate examples/workflows/cto
```

Refresh the checked skill fingerprints after editing the local role skill:

```bash
bun run dev -- lock examples/workflows/cto
```
