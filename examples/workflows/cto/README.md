# CTO Omniskills Workflow

Use this workflow when an agent should act as a startup CTO: inspect architecture,
surface technical risk, and turn product direction into engineering strategy.

## Architecture Deliverables

The CTO must invoke Archify for every architecture deliverable. Each deliverable
must include a validated self-contained HTML diagram and a review-friendly dual-theme SVG
export. There is no text-only substitute.

If Archify is unavailable, or validation or export fails, stop and report the
blocker instead of presenting the architecture deliverable as complete.

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
