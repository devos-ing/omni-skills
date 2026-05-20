# Architecture

## System Purpose

devos.ing is a multi-project orchestration hub that pulls eligible Linear issues and executes a staged agent loop: planning, implementation, and review/testing.

## Ownership Boundaries

1. `packages/cli/src/core/config.ts` is the only runtime config resolver for env vars and config files.
2. `packages/cli/src/features/workflow/` owns stage transitions, retries, and orchestration order.
3. Integration modules stay isolated under `packages/cli/src/integrations/`, while agent runtime adapters live in `packages/agent-adapters/`:
   - `packages/cli/src/integrations/linear/linear.ts`
   - `packages/cli/src/integrations/github/github.ts`
   - `packages/agent-adapters/src/codex/index.ts`
   - `packages/agent-adapters/src/claude/index.ts`
   - `packages/cli/src/integrations/notifications/notifications.ts`
4. Server-owned cron runtime and scheduling live under `packages/server/src/cron/` (entrypoint: `packages/server/src/cron/run-cron.ts`).
5. `packages/cli/src/features/workflow/state.ts` owns run-state paths and legacy fallback behavior.
6. `packages/cli/src/args.ts` and `packages/cli/src/index.ts` own CLI parsing and command dispatch with command handlers in `packages/cli/src/commands/`.

## Stage Model

The workflow advances through planning -> implementing -> review/testing and synchronizes Linear status and comments at each boundary. Review output must preserve the parsing contract:

- `RESULT: PASS|FAIL`
- `SUMMARY: ...`
- `BUGS_JSON: [...]`

## System Diagram

```mermaid
flowchart TD
    operator[Operator] --> linearIssue[Linear Issue Intake]
    linearIssue --> config[packages/cli/src/core/config.ts<br/>project + runtime resolution]
    config --> workflow[packages/cli/src/features/workflow<br/>stage orchestration]

    workflow --> planning[Planning Agent]
    planning --> complexity{Complexity Score < 5?}

    complexity -->|Yes| implementing[Implementation Agent]
    complexity -->|No| humanReview[Human Review Pause]

    implementing --> github[packages/cli/src/integrations/github/github.ts<br/>branch + draft PR updates]
    github --> reviewTesting[Review/Testing Agent]

    reviewTesting --> reviewPass{RESULT: PASS?}
    reviewPass -->|No| implementing
    reviewPass -->|Yes| done[Done]

    workflow --> blocked[Blocked]
    humanReview --> reviewingStage[Reviewing Stage in Linear]

    workflow --> linearSvc[packages/cli/src/integrations/linear/linear.ts<br/>status + comments + child tasks]
    workflow --> notify[packages/cli/src/integrations/notifications/notifications.ts<br/>human review and outcome email]
    workflow --> state[packages/cli/src/features/workflow/state.ts<br/>run state + leases]

    state --> runFiles[.devos/projects/<project-id>/runs/*.json]
    state --> chatLogs[.devos/projects/<project-id>/chat-logs/*.json]

    planning --> codexAdapter[packages/agent-adapters/src/codex/index.ts]
    planning --> claudeAdapter[packages/agent-adapters/src/claude/index.ts]
    implementing --> codexAdapter
    implementing --> claudeAdapter
    reviewTesting --> codexAdapter
    reviewTesting --> claudeAdapter
```

## Multi-Project Runtime Rules

1. Every run resolves to one or more `project.id` values.
2. Run state is persisted under `.devos/projects/<project-id>/runs`.
3. Status reads require an explicit project id.
4. Default invocation without project flags targets the first configured project.
5. `--all-projects --issue <KEY>` must resolve to one unique project mapping.

## Integration Flow

1. Linear issues are fetched and routed by project config and optional `linear.projectId`.
2. Planning prompt is built from issue context and skill input.
3. Optional planning skill auto-selection can append supplemental skills from `skills.root` and/or a SQLite skills catalog when `skills.autoSelect.enabled` is true.
4. Implementation session applies code changes and creates/updates PR context.
5. Review/testing session emits structured pass/fail output and bug payload.
6. Failed verification feeds back into implementation until pass or blocked.
