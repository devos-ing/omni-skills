# Founding Engineer Omniskills Workflow

Use this workflow when an agent should act as a startup founding engineer:
prepare a read-only implementation frame, identify affected seams and valuable
tests, surface technical risk, and hand the approved frame to a separate
implementer. It does not edit files or run implementation commands.

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
