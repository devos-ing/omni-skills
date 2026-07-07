# Engineering Manager GetSuperpower

Use this workflow when an agent should act as a startup engineering manager:
sequence delivery, manage execution risk, and keep quality gates realistic.

Install it from the repo root:

```bash
bun run dev -- install examples/workflows/engineering-manager
```

Validate it while authoring:

```bash
bun run dev -- validate examples/workflows/engineering-manager
```

Refresh the checked skill fingerprints after editing the local role skill:

```bash
bun run dev -- lock examples/workflows/engineering-manager
```
