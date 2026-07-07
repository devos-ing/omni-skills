# QA Lead GetSuperpower

Use this workflow when an agent should act as a startup QA lead: identify release
risk, sharpen acceptance checks, and verify the work before completion.

Install it from the repo root:

```bash
bun run dev -- install examples/workflows/qa-lead
```

Validate it while authoring:

```bash
bun run dev -- validate examples/workflows/qa-lead
```

Refresh the checked skill fingerprints after editing the local role skill:

```bash
bun run dev -- lock examples/workflows/qa-lead
```
