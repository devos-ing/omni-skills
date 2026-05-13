# ADHD.ai CLI Agent Instructions

The CLI package owns command parsing, runtime configuration, workflow
orchestration, agent integrations, and local run state. Keep CLI behavior
project-agnostic across all configured workspaces.

## Ownership Rules

1. Keep CLI parsing and dispatch in `packages/cli/src/args.ts`,
   `packages/cli/src/index.ts`, and command handlers.
2. Resolve env vars and config only through CLI config modules. Preserve
   `packages/cli/src/features/config/index.ts` as the canonical runtime config entry.
3. Keep stage transitions, sequencing, retries, and orchestration in
   `packages/cli/src/features/workflow/`.
4. Keep run-state path logic in `packages/cli/src/features/workflow/state.ts`
   and related workflow state helpers.
5. Keep integrations isolated in:
   - `packages/cli/src/integrations/linear/`
   - `packages/cli/src/integrations/github/`
   - `packages/cli/src/integrations/agent-adapters/`
   - `packages/cli/src/integrations/notifications/`
6. Keep CLI-facing server helpers in `packages/cli/src/features/server/` until
   they are intentionally moved behind an explicit shared/server boundary.
7. Do not construct raw shell command strings in workflow logic; use helper
   modules that pass command arguments as structured arrays.

## Contracts And Tests

1. Keep TypeScript interfaces/type aliases in dedicated `*.types.ts` modules
   when adding or changing contracts.
2. Keep review parsing contract stable:
   - `RESULT: PASS|FAIL`
   - `SUMMARY: ...`
   - `BUGS_JSON: [...]`
3. Add tests for any new CLI flag, config shape, state path, integration
   behavior, or workflow stage transition.
4. Prefer focused CLI tests under `packages/cli/tests/` for CLI package changes.
