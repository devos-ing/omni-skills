---
name: setup-model-routing
description: Configure global Codex model and effort routing for planning, implementation, and verification.
---

# Setup Model Routing

Configure global Omniskills routing. V1 launches labeled roles through Codex CLI only; do not promise Claude dispatch or MCP control.

1. Run `omniskill setup-model-routing --list-models --json` and show visible models with their supported efforts.
2. Ask one question at a time for `planning`, `implementation`, and `verification`: first model, then one supported effort.
3. Run the six-value command with `--dry-run --json`. Show the config path, affected workflows, and profile changes.
4. Wait for explicit confirmation. Cancellation stops with no writes.
5. After approval, rerun the exact six values with `--apply --json`.
6. Report the applied selections, regenerated profiles, conflicts, and rollback failure if present.

Never edit `~/.omniskills/orchestration.json` directly. Never add `--apply` before the user approves the dry-run plan. Never claim the model of the current root session changed.
