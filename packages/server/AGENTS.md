# devos.ing Server Agent Instructions

The server package owns the HTTP/API runtime for operator-facing services. Keep
server code focused on request handling, API process concerns, and explicit
boundaries to CLI or shared behavior.

## Ownership Rules

1. Keep server runtime and HTTP/API process concerns under
   `packages/server/src/`.
2. Organize server behavior into feature-oriented modules for API/domain
   behavior and keep cross-cutting concerns in centralized infrastructure
   modules.
3. Treat database access, shared config/env resolution, middleware, logging,
   and health/readiness behavior as infrastructure concerns with explicit
   boundaries.
4. Keep request handlers small, route behavior explicit, and validate boundary
   inputs (payloads, query params, path params, webhooks, and third-party data)
   at the edge.
5. Keep server contracts in dedicated `*.types.ts` modules separate from runtime
   implementation.
6. Use stable error categories and status mapping so route failures produce
   predictable response shapes for callers and tests.
7. Do not duplicate CLI workflow, config, or integration business logic in the
   server package.
8. Call CLI-facing or shared APIs only through explicit boundaries. If a new
   boundary is needed, define the contract first, then keep the runtime adapter
   narrow.
9. Keep middleware and logs security-minded: include request/failure context
   without exposing secrets, credentials, tokens, or private user content.
10. Keep health and readiness behavior simple, deterministic, and covered by
   tests.

## Tests

1. Add or update tests under `packages/server/tests/` for new routes, response
   shapes, boundary validation, health/readiness behavior, server config, and
   error handling/status mapping.
2. Run package-level checks when server behavior changes:
   - `bun run --filter adhdai-server check`
   - `bun run --filter adhdai-server typecheck`
   - `bun run --filter adhdai-server test`
3. For cross-workspace impact or release readiness, run repository quality
   gates with Bun:
   - `bun run check`
   - `bun run typecheck`
   - `bun test`

## Workflow Checkpoints

- Before implementation edits, re-state the scoped plan and confirm the server
  modules expected to change.
- After implementation edits and before validation, summarize changed behavior
  and any tests added or updated.
- After checks run, report pass/fail/blocker status, skipped commands, and
  remaining risk.
