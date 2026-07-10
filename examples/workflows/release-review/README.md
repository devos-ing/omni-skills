# Release Review Omniskills Workflow

This is an example Omniskills workflow for teams that want an agent to shape, review,
plan, and preserve evidence for release-related changes.

Install it from the repo root:

```bash
bun run dev -- install examples/workflows/release-review
```

Validate it while authoring:

```bash
bun run dev -- validate examples/workflows/release-review
```

The local `release-risk-review` skill is included to demonstrate how
Omniskills authors can add workflow-specific guidance without changing the
Omniskills runtime.
