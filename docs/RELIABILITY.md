# Reliability

## Runtime Expectations

1. Each run resolves to one or more `project.id` values.
2. Project-scoped state is persisted under `.devos/projects/<project-id>/runs`.
3. Status reads require explicit project id context.
4. Default non-project invocation runs against the first configured project.

## Integration Boundary Layout

1. External integrations are organized under `packages/cli/src/integrations/` by domain (`linear/`, `github/`, `cron/`, `notifications/`).
2. Agent runtime adapters are isolated in `packages/agent-adapters/`.
3. Workflow sequencing remains in `packages/cli/src/features/workflow/` and related stage/orchestrator modules.

## Parallel Processing Safety Model

devos.ing combines queue behavior, per-issue leases, and execution-path locking to reduce duplicate work and checkout conflicts.

### 1) Queue Processing Behavior

1. Standard runs process issues sequentially within each project cycle unless `--concurrency` or `run.concurrency` is set.
2. Review-only runs enqueue all candidate issues and can also use bounded concurrency.
3. `--isolated-worktrees`, `PIV_ISOLATED_WORKTREES=1`, or `workflow.isolatedWorktrees.enabled` lets parallel workers run in per-issue git worktrees instead of sharing one checkout.

### 2) Per-Issue Lease (Persisted Run-State Lock)

1. Before processing an issue, the worker attempts to acquire a lease in run state under `.devos/projects/<project-id>/runs`.
2. Lease metadata includes `ownerId`, `acquiredAt`, `heartbeatAt`, and `expiresAt`.
3. If another unexpired owner holds the lease, the issue is skipped for that worker.
4. Active workers heartbeat the lease during stage execution and release it when finished.

### 3) Stale Retry Guard

1. Stale retry eligibility requires both conditions:
2. The lease is expired.
3. `updatedAt` is older than `staleRunTimeoutMs`.
4. This prevents immediate reclaim of work that is still actively leased.

### 4) Execution-Path Locking

1. Issue execution is serialized by `executionPath` inside the running devos.ing process.
2. This avoids concurrent checkout/branch mutation in the same execution directory when multiple workers are active.
3. The lock is process-local and in-memory; it is not a distributed lock across separate devos.ing processes.
4. When isolated worktrees are enabled, only worktree preparation briefly uses the base execution-path lock; issue execution runs in the per-issue worktree.

### 5) Safety Envelope Summary

1. Per-issue leases protect against duplicate processing of the same issue key.
2. Execution-path locking reduces repository mutation conflicts for implement/review loops in one process.
3. Multiple independent devos.ing processes should use isolated worktrees or distinct execution paths to avoid checkout conflicts.

## Polling and Recovery

1. Polling is configured globally (`intervalMs`, `maxCycles`, `exitWhenIdle`, `staleRunTimeoutMs`).
2. In-progress runs acquire a per-issue lease to prevent duplicate workers from processing the same issue concurrently.
3. Stale in-progress runs are eligible for requeue only after lease expiry and timeout.
4. `--all-projects --issue` must resolve to one unique project mapping.

## Daemon-Owned Workflow Polling

The previous server-owned poller design is superseded. Continuous workflow polling belongs to the CLI daemon process, while the API server stays focused on HTTP, realtime proxying, database reads/writes, and command-stream forwarding.

1. `devos daemon` starts a supervised `run --all-projects --poll-forever` child alongside the API server and web UI.
2. `--poll-forever` implies polling, ignores configured max cycles, disables idle exit, and cannot be combined with `--max-poll-cycles`.
3. Workflow duplicate prevention remains in the existing per-issue run lease and stale-run recovery model.
4. CLI polling records status/events in the polling observability tables, which the server exposes through `/api/polling/status`.
5. CLI daemon task mutations notify the server over `/daemon/events` with only a task ID; the server rereads the database and publishes trusted `/api/events` updates.
6. `/api/cli/stream` remains request-scoped command streaming and is not used for background polling notifications.
7. Server cron remains separate as `devos-server cron`; it is not started by the API server process.

## Verification Signal Contract

Review/testing output must preserve:

- `RESULT: PASS|FAIL`
- `SUMMARY: ...`
- `BUGS_JSON: [...]`

## Planning Decomposition Contract

Planning output can optionally include:

- `COMPLEXITY: SIMPLE|COMPLEX`
- `SPLIT_TASKS_JSON: [...]` (required only when complexity is `COMPLEX`)

When `COMPLEXITY: COMPLEX` is returned, devos.ing creates child Linear tasks from `SPLIT_TASKS_JSON` and completes the parent issue without entering implementation/review stages.

## Docker Isolated Codex Execution

Docker-backed Codex execution is not implemented in this branch yet. Isolation work is tracked under ROY-95, and this section documents current behavior plus implementation expectations.

Current behavior:

1. devos.ing runs Codex directly on the host using `codex.binary`.
2. `CODEX_HOME` (or `codex.codexHome`) is passed to the host Codex process when configured.
3. No `codex.docker.*` config block or `CODEX_DOCKER_*` env variable is currently read by the runtime config loader.

Planned Docker execution expectations (ROY-95 scope):

1. Host execution remains the default unless Docker mode is explicitly enabled.
2. Docker image should include the configured Codex binary (default: `codex`) and required workflow tooling (`git`, `gh`, `bun`, project dependencies).
3. Mount/path behavior should preserve workspace and execution path correctness and support `CODEX_HOME` mapping when provided.
4. Container user permissions must allow read/write access for repository paths and devos.ing state/output files.

For security caveats around mounted paths, permissions, and credential exposure, see [docs/SECURITY.md](SECURITY.md).
