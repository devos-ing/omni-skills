# Security

## Secrets and Credentials

1. Treat API keys and tokens as environment-provided secrets.
2. Do not hardcode credentials in repository files.
3. Keep environment resolution centralized in `src/config.ts`.
4. Local secret storage uses `.piv-loop/config/env.sqlite`; keep `.piv-loop/` ignored and never commit this database.

## Command Safety

1. Avoid raw shell command construction in workflow logic.
2. Use module-level helpers for command execution and argument handling.

## Integration Access

1. Linear access is scoped by configured API key and optional project routing.
2. GitHub actions should run through authenticated `gh` usage.
3. Codex execution settings should remain explicit in config and per-project overrides.
