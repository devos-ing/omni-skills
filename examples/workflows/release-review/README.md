# Release Review GetSuperpower

This is an example GetSuperpower for teams that want an agent to shape, review,
plan, and preserve evidence for release-related changes.

Install it from the repo root:

```bash
getsuperpower install examples/workflows/release-review
getsuperpower clone examples/workflows/release-review
```

`getsuperpower clone <source>` is equivalent to `getsuperpower install <source>`.

Validate it while authoring:

```bash
getsuperpower validate examples/workflows/release-review
```

The local `release-risk-review` skill is included to demonstrate how
GetSuperpower authors can add workflow-specific guidance without changing the
GetSuperpower runtime.
