# API client generation status

`ROY-160` evaluates Orval wiring for typed client generation from an OpenAPI contract.

Current branch state:
- No ROY-156 OpenAPI contract file (for example `openapi.yaml`) exists in repository-owned server/web/docs paths.
- Without that source contract, Orval cannot be reliably configured or validated in this worktree.

Fallback implemented:
- `client.types.ts` defines typed request/response contracts.
- `client.ts` provides a minimal typed `fetch` client for the current server API surface (`GET /health`).
- `web-client.ts` creates a browser client that targets root-relative server paths so Next.js can proxy to the server package.
- `command-stream-client.ts` streams CLI command frames over the shared `/api/workflow` WebSocket endpoint.
- `client.typecheck.ts` adds compile-time usage coverage so `bun run --filter web typecheck` verifies the client contract.

Runtime wiring:
- `packages/web/next.config.ts` rewrites `/api/:path*` to `${DEVOS_SERVER_BASE_URL}/api/:path*` and `/health` to `${DEVOS_SERVER_BASE_URL}/health`.
- `DEVOS_SERVER_BASE_URL` defaults to `http://127.0.0.1:3001` when unset.
- Browser WebSocket streams go through the server-owned `/api/workflow` endpoint: `web -> server /api/workflow -> CLI worker`.
- Browser realtime updates use `/api/events`; continuous workflow polling is owned by `devos daemon`, not by a browser WebSocket stream.
- CLI workflow database reads/writes and command dispatch both share `/api/workflow`; the CLI worker connects outbound and does not expose a port.
- `NEXT_PUBLIC_DEVOS_WORKFLOW_WS_URL` can override the browser workflow websocket target.

Next step when ROY-156 OpenAPI lands:
- Add Orval config and generation scripts to emit into `packages/web/src/lib/api/generated`.
