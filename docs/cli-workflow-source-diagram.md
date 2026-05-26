# CLI Workflow Source Diagram

This diagram maps the main control flow in `packages/cli/src/features/workflow`.
Read it from top to bottom: command entry builds `RunOptions`, workflow cycles
select work, issue execution acquires safety guards, then the stage machine calls
agent and integration boundaries.

```mermaid
flowchart TD
  Cli["devos run\nargs.ts registerRunCommand"] --> RunCommand["handleRunCommand\nfeatures/commands/issues/run-command.ts"]
  Server["Server / daemon dispatch\nCliCommandExecutor -> buildRunArgs"] --> Cli
  Worker["workflow-worker websocket\nworkflow-command-worker.ts"] --> Server

  RunCommand --> RunWorkflow["runWorkflow\nworkflow.ts"]
  RunWorkflow --> Polling["resolvePollingSettings\nworkflow-polling.ts"]
  RunWorkflow --> Projects["pickProjects / routeProjectContextsForTargetIssue"]
  Projects --> RuntimeClient["runtime.createLinearClient\nworkflow-runtime.ts"]
  RuntimeClient --> BoardClient["BoardTaskWorkflowClient\nboard-task-workflow-client.ts"]
  RuntimeClient -. production-compatible boundary .-> LinearLike["WorkflowLinearClient\nboard tasks or Linear-shaped client"]

  RunWorkflow --> CycleLoop{"polling cycle"}
  CycleLoop --> ProjectCycle["runProjectCycle"]
  ProjectCycle --> Queue["buildIssueQueueForProjectCycle"]
  Queue --> Assigned["fetchWork\nready plan tasks"]
  Queue --> Stale["fetchStaleIssuesForRetry\nlocal stale run states"]
  Queue --> ReviewOnly["fetchReviewOnlyIssues\nin_review / done"]
  Assigned --> Prioritize["selectIssueQueueForCycle\nsort by priority"]
  Stale --> Prioritize
  ReviewOnly --> Prioritize
  Prioritize --> Drain["processIssueQueueBounded\nconcurrency"]

  Drain --> Issue["processIssue"]
  Issue --> State["loadRunState / saveRunState\n.devos/projects/<project>/runs"]
  Issue --> Lease["tryAcquireRunLease\nworkflow-lease.ts"]
  Issue --> Worktree{"isolated worktree?"}
  Worktree -- yes --> Isolated["prepareIsolatedExecutionWorkspace\nworkflow-worktree.ts"]
  Worktree -- no --> Lock["withExecutionPathLock\nshared execution path"]
  Isolated --> Execute["executeIssue"]
  Lock --> Execute

  Execute --> Fresh["runtime.ensureBaseBranchFresh"]
  Fresh --> Agent["runtime.createAgentAdapter\npackages/agent-adapters"]
  Agent --> StageMachine{"state.stage"}

  StageMachine -- backlog --> Received["handleReceivedStage\nmark plan"]
  StageMachine -- plan --> Plan["handlePlanningStage\nplan.ts"]
  StageMachine -- in_progress --> Implement["handleImplementingStage\nworkflow.ts"]
  StageMachine -- in_review --> Review["handleReviewTestingStage\nreview-stage.ts"]
  StageMachine -- done and reviewOnly --> Merge["handleDoneReviewMergeStage\nfinalizeIssueAfterReviewMerge"]

  Plan --> PlanResult{"planner result"}
  PlanResult -- NEEDS_INFO --> Cancel["mark canceled\ncomment + notify"]
  PlanResult -- READY simple --> Implement
  PlanResult -- split tasks --> DoneSplit["create child tasks\nmark done"]

  Implement --> PR["prepare branch\ncreate/update draft PR\nlink PR"]
  PR --> Review

  Review --> ReviewResult{"review outcome"}
  ReviewResult -- fail, retries left --> Implement
  ReviewResult -- fail, no auto path --> Human["park in_review\nhuman review notification"]
  ReviewResult -- pass --> DoneReady["mark local done\nPR ready for review"]
  Merge --> DoneFinal["mark issue done\nnotify outcome"]

  Issue --> Recorder["workflow execution recorder"]
  Issue --> Progress["progress events\nDEVOS_WORKFLOW_PROGRESS_STREAM"]
  CycleLoop --> PollEvents["recordCliPollingEvent\npolling observability"]
```

## Stage State Machine

`executeIssue` is the stage router. It keeps looping until the run state reaches
`done`, `canceled`, or `failed`.

```mermaid
stateDiagram-v2
  [*] --> plan: new ready task
  [*] --> in_review: review-only task
  backlog --> plan: handleReceivedStage

  plan --> canceled: planner NEEDS_INFO
  plan --> in_progress: simple READY plan
  plan --> done: planner splits into child tasks

  in_progress --> in_review: implementation creates or updates PR

  in_review --> in_progress: review fails and auto-fix pass remains
  in_review --> in_review: review fails and needs human updates
  in_review --> done: review passes; PR ready

  done --> done: review-only merge gate may squash merge
  done --> [*]
  canceled --> [*]
  failed --> [*]
```

## Source Ownership

| Concern | Primary files |
| --- | --- |
| CLI command parsing | `packages/cli/src/args.ts` |
| CLI run command handler | `packages/cli/src/features/commands/issues/run-command.ts` |
| Server/daemon command dispatch | `packages/cli/src/features/server/cli-command-executor.ts`, `packages/cli/src/features/daemon/workflow-command-worker.ts` |
| Main workflow loop and stage router | `packages/cli/src/features/workflow/workflow.ts` |
| Planning stage | `packages/cli/src/features/workflow/plan.ts` |
| Review/testing stage | `packages/cli/src/features/workflow/review-stage.ts` |
| Queueing, retry selection, concurrency | `packages/cli/src/features/workflow/workflow-queue.ts` |
| Run-state persistence | `packages/cli/src/features/workflow/state.ts` |
| Leases | `packages/cli/src/features/workflow/workflow-lease.ts` |
| Isolated worktrees | `packages/cli/src/features/workflow/workflow-worktree.ts` |
| Runtime integration boundary | `packages/cli/src/features/workflow/workflow-runtime.ts` |
| Board-task workflow client | `packages/cli/src/features/workflow/board-task-workflow-client.ts` |

## Mental Model

1. `args.ts` turns CLI flags into `RunOptions`.
2. `runWorkflow` chooses projects and repeats cycles when polling is enabled.
3. `runProjectCycle` gathers eligible work, merges stale retry candidates, sorts
   the queue, and runs bounded workers.
4. `processIssue` is the safety wrapper: local state, identity refresh, lease,
   execution-path lock, optional isolated worktree, recorder, cleanup.
5. `executeIssue` is the actual state machine: plan, implement, review, and
   finalize.
6. `WorkflowRuntime` keeps side effects behind a boundary: task client, agent
   adapter, GitHub operations, worktree management, PR comments, merges, and
   notifications.
