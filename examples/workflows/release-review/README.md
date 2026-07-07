# Release Review GetSuperpower

This is an example GetSuperpower for teams that want an agent to shape, review,
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
GetSuperpower authors can add workflow-specific guidance without changing the
GetSuperpower runtime.
