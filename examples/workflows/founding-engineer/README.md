# Founding Engineer GetSuperpower

Use this workflow when an agent should act as a startup founding engineer:
implement the plan, keep tests close to the change, debug failures, and verify
before handoff.

Install it from the repo root:

```bash
bun run dev -- install examples/workflows/founding-engineer
```

Validate it while authoring:

```bash
bun run dev -- validate examples/workflows/founding-engineer
```

Refresh the checked skill fingerprints after editing the local role skill:

```bash
bun run dev -- lock examples/workflows/founding-engineer
```
