# devos.ing Operator-First Roadmap

## Summary

This roadmap moves devos.ing toward a reliable local operator system first,
then expands into remote control, integrations, autonomous skill improvement,
and hosted cloud coordination.

The core product direction is:

1. Keep workflow execution owned by outbound CLI workers.
2. Make the server and web UI the operator control plane.
3. Add Telegram, Linear OAuth, Slack, and Trello through typed integration
   boundaries instead of one-off workflow logic.
4. Treat token usage, skill selection, and skill improvement as first-class
   operator concerns.
5. Preserve local-first operation while preparing for a future cloud service.

## Checkpoints

### 1. Daemon Control Foundation

Objective: let operators inspect and control the daemon without terminal access.

Implementation checkpoints:

1. Add shared daemon control contracts for status, active runs, pause, resume,
   stop, restart, approve, reject, and logs.
2. Add server routes that validate typed control intents and forward them to the
   CLI worker boundary.
3. Keep workflow orchestration in `packages/cli`; server routes must not
   duplicate workflow business logic.
4. Persist an audit trail for operator control actions.

Success signal: the web UI or a future integration can safely inspect daemon
state and send control actions through one typed API.

### 2. Telegram Operator Integration

Objective: provide remote daemon control and notifications through Telegram.

Implementation checkpoints:

1. Add Telegram bot configuration, chat allowlisting, and project binding.
2. Route `/status`, `/runs`, `/pause`, `/resume`, `/approve`, `/reject`, and
   `/logs` to daemon control intents.
3. Send push notifications for blocked runs, human-review pauses, completion,
   and expensive-run warnings.
4. Redact secrets and private content from all Telegram-visible messages.

Success signal: a trusted Telegram chat can operate devos remotely with the same
guardrails and audit trail as the web UI.

### 3. Operator Console App

Objective: make the existing Next.js web UI the default daily control surface.

Implementation checkpoints:

1. Add daemon status, active runs, approvals, queues, agents, skills, usage, and
   logs to the operator console.
2. Use existing React Query and API client boundaries for data access.
3. Use server events and daemon events for realtime run updates.
4. Keep workflow execution and integration logic outside `packages/web`.

Success signal: an operator can manage normal devos activity from the app
without opening a terminal for routine control tasks.

### 4. Token Usage Accounting

Objective: answer what each workflow costs and where tokens are spent.

Implementation checkpoints:

1. Capture usage consistently across planning, implementation, review/testing,
   retries, and all agent adapters.
2. Attribute usage by project, run, task, stage, agent, provider, model, and
   recorded date.
3. Add configurable model pricing and estimated cost fields.
4. Expose aggregate usage views through server APIs and the web UI.

Success signal: every workflow run has inspectable usage and estimated cost
broken down by meaningful operator dimensions.

### 5. Token Burn Optimization

Objective: reduce avoidable spend without starving agents of useful context.

Implementation checkpoints:

1. Add project and stage budgets with warning and hard-stop modes.
2. Add retry budgets, duplicate-run prevention surfaces, and expensive-run
   alerts.
3. Add prompt and context trimming policies that are visible to operators.
4. Surface highest-cost projects, stages, agents, and skills in dashboards.

Success signal: operators can detect and control runaway cost before a workflow
burns through unnecessary tokens.

### 6. Flexible Agent Skill Selection

Objective: let operators tune skills per agent and stage without editing code.

Implementation checkpoints:

1. Extend skill selection policies to support explicit, auto-selected, and mixed
   modes per stage.
2. Add skill provenance, version pins, compatibility metadata, and selected-by
   metadata.
3. Add a dry-run preview that shows which skills would be passed to each agent.
4. Keep TypeScript contracts in dedicated `*.types.ts` modules.

Success signal: an operator can preview and adjust skill selection for planning,
implementation, and review/testing from configuration or the app.

### 7. Internet Skill Sync

Objective: sync skills from trusted external sources without losing auditability.

Implementation checkpoints:

1. Add a skill registry source model with allowlists, checksums, and version
   pins.
2. Add sync preview, install/update, rollback, and provenance display.
3. Require inspectable content before synced skills are eligible for execution.
4. Reject untrusted or checksum-mismatched skill content.

Success signal: devos can pull approved skills from external sources while
preserving trust boundaries and rollback paths.

### 8. Dreaming System For Skill Improvement

Objective: use past workflow evidence to propose better skills.

Implementation checkpoints:

1. Add scheduled dream jobs that inspect run outcomes, review failures, operator
   corrections, token usage, and repeated blockers.
2. Generate proposed skill changes, eval cases, and changelog notes.
3. Require human review before any dream output updates executable skills.
4. Store dream proposals with evidence links and acceptance status.

Success signal: devos can suggest skill improvements grounded in real runs
without silently changing agent behavior.

### 9. OAuth Integrations: Linear First

Objective: make Linear connection setup app-driven instead of API-key-only.

Implementation checkpoints:

1. Add OAuth connection records, callback validation, token storage boundaries,
   and reconnect flows.
2. Add Linear workspace, team, project, board, status, and issue discovery.
3. Add webhook intake for issue/task updates.
4. Keep existing Linear API-key configuration working during migration.

Success signal: operators can connect Linear from the app while existing local
config users remain unbroken.

### 10. Slack And Trello Integrations

Objective: add collaboration and task-source integrations through shared models.

Implementation checkpoints:

1. Add Slack OAuth, channel binding, notifications, approval actions, and run
   summaries.
2. Add Trello OAuth, board/list/card discovery, and card-to-task ingestion.
3. Introduce a common task-source abstraction shared by Linear, Trello, and
   future cloud-created tasks.
4. Keep provider-specific behavior isolated under integration modules.

Success signal: Slack and Trello fit the same operator and task-source model
instead of creating parallel workflow paths.

### 11. Cloud Service

Objective: support hosted coordination while preserving local-first operation.

Implementation checkpoints:

1. Add hosted account, organization, project, and member concepts.
2. Add encrypted OAuth connection storage, hosted dashboards, usage reporting,
   and billing-ready cost records.
3. Add remote daemon registration so local daemons can connect to cloud control.
4. Keep self-hosted/local operation usable without a cloud account.

Success signal: devos can operate as a self-hosted local system or as a hosted
coordination service using the same core contracts.

## Shared Interface Work

Implement these contracts before provider-specific feature work where possible:

1. Daemon control intent and result types shared by server, web, Telegram, and
   future cloud.
2. Integration connection records for Telegram, Linear, Slack, Trello, and
   future OAuth providers.
3. Task-source records so Linear, Trello, and cloud-created tasks share one
   ingestion shape.
4. Token usage attribution and cost fields covering provider, model, agent,
   project, task, run, stage, and date.
5. Skill metadata for source, version, checksum, selection policy, compatibility,
   provenance, and sync status.

## Validation Plan

Required validation should scale with each checkpoint:

1. Unit tests for control-intent validation, OAuth state handling, cost
   calculation, usage aggregation, skill selection, and registry trust checks.
2. Integration tests for Telegram command routing, Linear OAuth sync, Slack
   notifications, Trello card ingestion, and daemon control forwarding.
3. Web/API contract tests for operator console data fetching and realtime daemon
   update handling.
4. End-to-end smoke tests for task creation, workflow execution, notification,
   approval/rejection, and usage reporting.
5. Security tests for secret redaction, OAuth callback validation, skill sync
   allowlists, checksum mismatch handling, and permission boundaries.

## Implementation Defaults

1. Use Bun for all package management, scripts, filters, and tests.
2. Keep workflow execution in the CLI package; server and integrations send
   typed intents through narrow boundaries.
3. Keep server request validation at the HTTP edge.
4. Keep web UI data access in API client modules and use existing React Query
   patterns.
5. Keep TypeScript interfaces and type aliases in dedicated `*.types.ts`
   modules when adding or changing contracts.
6. Preserve local-first operation while adding cloud-compatible contracts.
