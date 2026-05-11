# Reliability

## Runtime Expectations

1. Each run resolves to one or more `project.id` values.
2. Project-scoped state is persisted under `.piv-loop/projects/<project-id>/runs`.
3. Status reads require explicit project id context.
4. Default non-project invocation runs against the first configured project.

## Polling and Recovery

1. Polling is configured globally (`intervalMs`, `maxCycles`, `exitWhenIdle`, `staleRunTimeoutMs`).
2. In-progress runs acquire a per-issue lease to prevent duplicate workers from processing the same issue concurrently.
3. Stale in-progress runs are eligible for requeue only after lease expiry and timeout.
4. `--all-projects --issue` must resolve to one unique project mapping.

## Verification Signal Contract

Review/testing output must preserve:

- `RESULT: PASS|FAIL`
- `SUMMARY: ...`
- `BUGS_JSON: [...]`

## Planning Decomposition Contract

Planning output can optionally include:

- `COMPLEXITY: SIMPLE|COMPLEX`
- `SPLIT_TASKS_JSON: [...]` (required only when complexity is `COMPLEX`)

When `COMPLEXITY: COMPLEX` is returned, ADHD.ai creates child Linear tasks from `SPLIT_TASKS_JSON` and completes the parent issue without entering implementation/review stages.

## Docker Isolated Codex Execution

Docker-backed Codex execution is not implemented in this branch yet. Isolation work is tracked under ROY-95, and this section documents current behavior plus implementation expectations.

Current behavior:

1. ADHD.ai runs Codex directly on the host using `codex.binary`.
2. `CODEX_HOME` (or `codex.codexHome`) is passed to the host Codex process when configured.
3. No `codex.docker.*` config block or `CODEX_DOCKER_*` env variable is currently read by the runtime config loader.

Planned Docker execution expectations (ROY-95 scope):

1. Host execution remains the default unless Docker mode is explicitly enabled.
2. Docker image should include the configured Codex binary (default: `codex`) and required workflow tooling (`git`, `gh`, `bun`, project dependencies).
3. Mount/path behavior should preserve workspace and execution path correctness and support `CODEX_HOME` mapping when provided.
4. Container user permissions must allow read/write access for repository paths and ADHD.ai state/output files.

For security caveats around mounted paths, permissions, and credential exposure, see [docs/SECURITY.md](SECURITY.md).
