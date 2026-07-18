# Setup Model Routing

Use this workflow to choose the global Codex model and reasoning effort for the
`planning`, `implementation`, and `verification` roles used by labeled teams.
It previews every change before applying it and does not change the model of an
already-running root session.

This workflow is currently a repository-local preview. From the repository
root, install the checked-out workflow:

```bash
bun run dev -- install examples/workflows/setup-model-routing
```

Restart the agent, then invoke:

```text
$setup-model-routing
```

The skill lists models visible to the signed-in Codex identity, asks for one
model and supported effort per role, runs a dry-run, and waits for explicit
approval before applying the same values. It updates the global orchestration
configuration and matching managed Codex profiles; Claude profiles continue to
use their configured tiers.

Validate or refresh its lock while authoring:

```bash
bun run dev -- validate examples/workflows/setup-model-routing
bun run dev -- lock examples/workflows/setup-model-routing
```
