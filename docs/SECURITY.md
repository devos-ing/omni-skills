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

## Docker Isolation Caveats

1. Docker-isolated Codex execution is planned work (ROY-95) and not active in this branch.
2. When Docker mode is implemented, container isolation will not remove access to host paths that are explicitly mounted into the container.
3. Host/container UID or GID mismatches can create files with unexpected ownership (for example root-owned artifacts) on mounted paths.
4. Mounting `CODEX_HOME` into the container can expose Codex credentials and configuration present in that directory.
5. Prefer minimal container privileges; avoid workflows that require privileged containers or Docker socket mounting.
