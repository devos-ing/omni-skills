# Reliability

## Runtime Expectations

1. Each run resolves to one or more `project.id` values.
2. Project-scoped state is persisted under `.devos/projects/<project-id>/runs`.
3. Status reads require explicit project id context.
4. Default non-project invocation runs against the first configured project.

## Integration Boundary Layout

1. External integrations are organized under `packages/cli/src/integrations/` by domain (`linear/`, `github/`, `cron/`, `notifications/`).
2. Agent runtime adapters are isolated in `packages/cli/src/integrations/agent-adapters/`.
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

## Server-Owned Poller Design (ROY-222)

This section defines a server-owned polling and dispatch workflow that can replace CLI polling over time, without removing CLI polling in this task.

### Scope

1. Design only: no runtime poller implementation change in this issue.
2. Preserve existing CLI workflow and parsing contracts.
3. Use structured command invocation boundaries only (no raw shell command strings).

### Poll Sources

1. Linear issues: same logical source currently consumed by CLI workflow polling.
2. Internal tasks: server-owned tasks persisted in internal tables (for example `board_tasks`).

### Eligibility Rules

1. Linear work is eligible when it matches configured project routing and workflow-eligible states/labels.
2. Internal work is eligible when task status, priority, assignment, and project context indicate it is ready for automation.
3. Skip candidates that are already claimed, actively running, completed, blocked for human review, or currently in retry backoff.
4. Skip candidates with unresolved project routing ambiguity.

### Claiming and Duplicate Prevention

1. Claims must be durable and server-owned, not process-local.
2. Claim identity should be normalized as `(source_type, source_id)` to handle both Linear issues and internal tasks.
3. Claim record should include:
4. `sourceType`, `sourceId`, `projectId`, `status`, `leaseOwnerId`, `claimedAt`, `heartbeatAt`, `leaseExpiresAt`, `attemptCount`, `nextRetryAt`, `lastError`, `updatedAt`.
5. Claim transition semantics must use atomic insert/update behavior so only one poller instance can claim a unit of work.
6. Overlap prevention in in-memory scheduler state is not enough; durable claim state is the duplicate-prevention source of truth.

### Retry and Backoff

1. Distinguish dispatch/infrastructure failures from completed CLI runs that return unsuccessful outcomes.
2. Increase `attemptCount` on retry-eligible failures and schedule `nextRetryAt` with capped exponential backoff.
3. Do not retry while current time is before `nextRetryAt`.
4. Expire stale `in_progress` claims using a lease timeout model aligned with existing run-lease behavior.
5. When reclaiming stale work, record the stale recovery event in logs.

### Dispatch Contract

1. Server dispatches through the existing `CliCommandExecutor` boundary (`devos/features/server/cli-command-executor`).
2. Dispatch uses structured action payloads that resolve to argv arrays, never raw command strings.
3. Linear dispatch request shape:
4. `action: "run"` with explicit `projectId` and `issueKey`, and polling disabled for that invocation.
5. Internal-task dispatch request shape:
6. Adapter-owned structured request that maps task context into existing CLI workflow/task actions without introducing raw shell fields.
7. Keep dispatch behind a dispatcher adapter interface so runtime can move from local process invocation to queue/worker execution later.

### Configuration

1. Global server poller enable/disable flag.
2. Per-source enable flags (`linear`, `internalTasks`).
3. Poll interval, claim batch size, dispatcher concurrency, lease timeout, retry/backoff policy, and optional project/source filters.
4. Migration period keeps CLI polling available and configurable independently.

### Observability

1. Emit logs for each poll cycle: source counts, eligible counts, claim attempts, claim conflicts/skips, dispatch starts/results, retries scheduled, and stale-claim recoveries.
2. Include stable identifiers (`sourceType`, `sourceId`, `projectId`, `attemptCount`) for troubleshooting.
3. Do not log secrets, access tokens, or sensitive task content.

### Migration Path

1. Phase 1 (this issue): design/spec only.
2. Phase 2: implement server poller behind disabled-by-default config.
3. Phase 3: run server poller in shadow mode or single-source mode and compare behavior against current CLI polling outcomes.
4. Phase 4: disable CLI polling via config/deployment once server dispatch reliability is proven.
5. CLI polling removal is explicitly out of scope for this issue.

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
