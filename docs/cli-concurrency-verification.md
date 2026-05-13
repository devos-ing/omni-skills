# CLI Two-Issue Concurrency Verification (ROY-175)

This runbook reproduces and characterizes CLI behavior for two issues when
`--concurrency` is greater than `1`.

## Goal

Collect evidence that shows whether two eligible issues:

1. Start separate workflow sessions concurrently.
2. Or are serialized at execution time because they share one `executionPath`.

## Scope

Use a single configured project with two assigned Linear issues (example:
`ENG-101` and `ENG-102`) and run one CLI process with `--concurrency 2`.

## Command

Run from `packages/cli`:

```bash
bun run src/index.ts run --project <PROJECT_ID> --concurrency 2
```

Optional focused run (if you only want these two issues in queue):

```bash
bun run src/index.ts run --project <PROJECT_ID> --concurrency 2 --poll --max-poll-cycles 1
```

## Evidence To Capture

Capture all of the following from the same run:

1. CLI logs:
   - `Fetched eligible Linear issues`
   - `Taking issue job`
   - Lease conflict/acquire behavior (`Skipping issue because it is already leased...`)
   - `Issue workflow finished`
2. Run-state files:
   - `.piv-loop/projects/<project-id>/runs/<ISSUE_KEY>.json`
3. Agent chat log entries:
   - `.piv-loop/projects/<project-id>/agent-chat-log.jsonl`

## Fields To Compare

For both issues, compare:

1. Lease metadata:
   - `lease.ownerId`
   - `lease.acquiredAt`
   - `lease.heartbeatAt`
   - `lease.expiresAt`
2. Stage/timing:
   - `stage`
   - `startedAt`
   - `updatedAt`
3. Session/workspace:
   - `codexSessionId`
   - `reviewSessionId`
   - `workspacePath`

## How To Interpret Results

1. Queue concurrency is real when both issues emit `Taking issue job` close in
   time under one CLI run with `--concurrency 2`.
2. Non-review-only execution may still serialize because workflow execution is
   wrapped by `withExecutionPathLock(config.executionPath)` in
   `packages/cli/src/features/workflow/workflow-orchestrator.ts`.
3. Review-only mode can run concurrently without that execution-path wrapper.
4. Lease owner IDs should differ between issue workers when both are active.
5. Final run-state snapshots may not include lease data because leases are
   released at completion; capture in-flight snapshots/logs when lease evidence
   is required.

## Source Pointers

1. Queue worker concurrency: `processIssueQueueBounded` in
   `packages/cli/src/features/workflow/workflow-queue.ts`
2. Per-issue lease acquire/heartbeat/release:
   `packages/cli/src/features/workflow/workflow-lease.ts`
3. Execution-path lock:
   `withExecutionPathLock` in
   `packages/cli/src/features/workflow/workflow-orchestrator.ts`
4. Run-state persistence:
   `packages/cli/src/features/workflow/state.ts`
5. Existing review-only concurrency smoke coverage:
   `packages/cli/tests/smoke-flow.test.ts`

## Notes

1. This verification is observational and can vary by issue content and agent
   turnaround time.
2. Keep interpretation tied to timestamps and persisted state/log artifacts, not
   assumptions from configured concurrency alone.
