# Orchestration Dispatch Design

**Date:** 2026-07-15

**Status:** Approved in conversation; pending written-spec review

**Decision owner:** Omniskills maintainer

## Summary

Add an enforceable execution plane to the existing orchestration control plane.
The current runtime validates team tier policy and installs model-specific Codex
and Claude profiles, but it does not own the operation that launches a child.
As a result, callers using a generic sub-agent API cannot prove that the child
used the planned profile, model, effort, or access mode.

The first releasable dispatcher will be an explicit, foreground CLI adapter. It
resolves an installed managed profile, constructs a runtime-specific launch
request without a shell, streams structured events, and records dispatch
evidence. A future native adapter may replace the subprocess when a host API can
select a profile and report the selection. Dispatch fails closed when neither
adapter can provide the required evidence.

This design extends, and narrowly supersedes, the earlier decision not to add a
CLI supervisor. It adds one foreground process per dispatched child; it does
not add a daemon, queue, scheduler, or persistent background supervisor.

## Problem

Generated profile files are desired configuration, not evidence of execution.
The generic Codex sub-agent interface available to the coordinator accepts a
task but no profile, model, or effort selector. Labeling such a child as
`deep / gpt-5.6 / high` would therefore violate the existing honest-enforcement
boundary.

The orchestration layer must provide one truthful answer to three questions:

1. Which managed profile was requested?
2. Which runtime settings were placed on the launch boundary?
3. What did the runtime report before work began?

## Goals

- Dispatch an installed team role or support task through an explicit adapter.
- Resolve model, effort, access, instructions, and candidate order from the
  recorded managed profile rather than from caller-supplied labels.
- Produce a machine-readable receipt distinguishing requested,
  launch-configured, and runtime-reported evidence.
- Fail before work when the profile is missing, foreign, drifted, unsupported,
  or cannot satisfy the configured evidence policy.
- Preserve same-tier retry, human-approved lower-tier fallback, implementation
  access gates, and bounded consultation.
- Keep live Codex and Claude side effects behind plugin interfaces.

## Non-goals

- Changing Codex or Claude's built-in generic sub-agent API.
- A background daemon, distributed queue, parallel scheduler, or cost ledger.
- Cross-vendor fallback.
- Automatic CLI installation, authentication, upgrade, or entitlement changes.
- Claiming the provider served an exact backend model when the runtime reports
  only the configured launch value.
- Replacing the existing native profile files; they remain useful for runtimes
  that discover them directly.

## Considered Approaches

### 1. Native-only dispatch

Inject a host callback that selects `profileId` and returns launch metadata.
This is the cleanest long-term path, but the currently exposed generic
sub-agent interface has no profile or model selector. Shipping only this path
would leave the defect unresolved.

### 2. Foreground CLI adapter, with an injectable native adapter later

Add `omniskill dispatch` and route it through a small runtime-neutral contract.
The Codex adapter launches `codex exec` with an argument array; a Claude adapter
can be added only after its local CLI contract is available and tested. The
adapter returns structured events and a receipt. This is the selected approach
because Ponytrails can enforce and test it without pretending to control the
host's generic agent tool.

### 3. Persistent orchestration supervisor

Run a daemon that owns child processes, retries, consultations, and state. This
would support richer scheduling but adds lifecycle, security, recovery, and
operational complexity that the current product does not need. It is rejected
for this version.

## Domain Model

### `DispatchRequest`

User intent after routing: installed workflow name, role or support source,
task text or task-file content, target runtime, prior handoff, approval state,
and requested evidence policy. It never accepts a caller-supplied model,
effort, or access override.

### `DispatchPlan`

Pure resolved data: install record, profile identity and hash, runtime, tier,
candidate index, model, effort, access, instructions, retry limits, and the
exact launch request. Planning performs no process or filesystem writes.

### `DispatchEvidence`

Three explicit levels:

- `requested`: the managed profile and policy chosen by the coordinator.
- `launch_configured`: the model, effort, access, and instructions placed on
  the runtime invocation boundary.
- `runtime_reported`: matching runtime metadata observed before task execution,
  when the runtime exposes it.

The receipt states the highest level actually obtained. It never upgrades
`launch_configured` evidence into `runtime_reported` by inference.

### `DispatchReceipt`

Immutable result containing run ID, timestamps, workflow, role, profile ID,
profile content hash, target, tier, candidate, model, effort, access, evidence
level, adapter, process or native session ID, terminal status, failure reason,
and consultation count.

### `ConsultationEvent`

A suspended child result with one approved trigger, current task, evidence,
decision needed, and recommendation. It is not an authorization message.

## Module Boundaries

- `src/runtimes/omniskill/orchestration-dispatch.ts` owns schemas, profile
  selection, dispatch planning, candidate progression, evidence evaluation,
  and receipt state transitions. It is pure except for injected record/profile
  readers.
- `src/plugins/orchestration-dispatcher.ts` owns runtime capability checks,
  subprocess launch, JSONL decoding, cancellation, and runtime event mapping.
- `src/omniskill.ts` owns the `dispatch` command, prompts, human approval gates,
  and rendering. `src/cli.ts` remains thin.
- Installed workflow records remain the authority for managed profile
  ownership. A profile file alone is insufficient.
- Live vendor behavior never enters the runtime module without an injected
  plugin interface.

## Public CLI

Initial command:

```bash
omniskill dispatch <workflow-name> \
  --role <source-or-support-id> \
  --task <text> \
  --runtime codex \
  [--home <dir>] \
  [--dir <dir>] \
  [--approve-workspace-write] \
  [--dry-run] \
  [--json]
```

`--task-file <path>` is mutually exclusive with `--task`. Standard input is
not part of v1 because consultation resume and nested process input need a
separate protocol design. The initial runtime is `codex`; requesting `claude`
returns a typed unsupported-adapter error until the Claude CLI is installed and
its arguments and event format are validated.

`--approve-workspace-write` is required only for a recorded
`workspace-write` profile. Supplying it is the explicit human implementation
gate and is persisted in the receipt. It cannot grant write access to a profile
recorded as read-only or change the profile's tier.

Dry-run prints or returns the complete `DispatchPlan` and performs no launch,
receipt write, profile write, or workflow mutation.

## Resolution and Preflight

1. Load the installed root workflow record.
2. Find exactly one recorded `agent_profile` artifact matching the requested
   role/support source, runtime, and primary candidate.
3. Require the recorded path to stay under the expected runtime agent directory
   in `homeDir`, then re-read the profile and verify the managed marker and
   recorded content hash.
4. Verify the selected source and profile are present in the root install
   record; dispatch does not re-resolve mutable remote workflow metadata.
5. Require `--approve-workspace-write` before a recorded workspace-write
   profile can launch.
6. Ask the adapter for capability and version information.
7. Build an argument-array launch request and evidence requirement.
8. Return the plan for dry-run or execute it after any required human gate.

Missing, duplicate, drifted, foreign, or obsolete profiles stop preflight.
`--force` is deliberately absent from dispatch; repair happens through
`omniskill install --force`, not at execution time.

## Codex Adapter

The adapter uses the existing subprocess seam and never invokes a shell. It
passes the configured model, reasoning effort, sandbox mode, working directory,
and non-interactive structured-output option explicitly. Role instructions and
task data are provided through a bounded input channel rather than interpolated
into a command string.

The adapter must classify startup events before task execution:

- selected model or runtime acknowledgement, when available;
- unsupported model or required CLI upgrade;
- authentication or entitlement failure;
- invalid configuration;
- task started without runtime model metadata.

Default policy permits execution at `launch_configured` evidence and discloses
that the runtime did not report the model. A future strict policy may require
`runtime_reported`. Any runtime-reported value that conflicts with the launch
plan fails closed.

## Retry and Fallback

- Retry the same candidate only after an observed adapter or task failure and
  only up to `retryPerCandidate`.
- Advance to the next candidate only within the same tier and runtime, recording
  the failed candidate and reason.
- Never cross vendors automatically.
- Never use a lower tier without a fresh human approval attached to the run.
- Reassignment selects another declared role, not another hidden model.

Every attempt receives its own receipt linked by one run ID.

## Consultation and Resume

V1 supports result-based consultation rather than live bidirectional agent
messaging. A child emits a final structured `consultation_request` event and
stops. The command persists the suspended receipt and exits with a distinct
status. A later command resumes the recorded runtime session after the
coordinator records one disposition:

```bash
omniskill dispatch resume <run-id> \
  --decision continue|retry|reassign|escalate-to-human \
  [--role <replacement-source>] \
  --message <text>
```

Resume validates the original profile hash, consultation count, approval state,
and runtime session identity. `--role` is required only for `reassign`; it must
resolve to another declared managed role in the same installed workflow. The
new role receives the original task plus the decision message as its prior
handoff, starts a new child session under the same run ID, and increments the
reassignment count. Reassignment stops at `reassignmentPerWorkItem`. Repeated
consultation without new evidence is rejected. The existing limit of two
consultations remains authoritative.

## State and Auditability

Receipts live under:

```text
~/.omniskills/runs/<workflow>/<run-id>/
  request.json
  plan.json
  attempts.jsonl
  receipt.json
```

Writes are atomic. Task text is stored because resume requires it; environment
variables, authentication data, and raw process environments are never stored.
The JSON output and persisted receipt use the same schema.

## Error Handling

Errors are typed and stable enough for tests and automation:

- `workflow_not_installed`
- `profile_not_found`
- `profile_ambiguous`
- `profile_path_invalid`
- `profile_drifted`
- `runtime_unavailable`
- `runtime_upgrade_required`
- `model_unavailable`
- `launch_evidence_insufficient`
- `runtime_mismatch`
- `approval_required`
- `consultation_required`
- `retry_exhausted`

Human-readable output includes the repair action. JSON output contains no
terminal styling and returns a non-zero process status for every failed-closed
condition.

## Startup Goal Integration

The team skill must perform dispatch preflight before disclosing a model and
effort. It may use native dispatch only when the host adapter proves profile
selection. Otherwise it calls the explicit CLI dispatcher. Generic
`spawn_agent` remains allowed only for work whose policy does not require a
specific profile, and it must be labeled `unverified`; `startup-team` deep,
standard, and fast assignments all require verified dispatch.

If neither adapter is available, the skill shows `Unavailable dispatch` with
prepared role briefs and stops, matching its existing fail-closed contract.

## Test Strategy

Tests operate at three public seams agreed in the approved design:

1. `planOrchestrationDispatch` pure runtime seam: role/profile resolution,
   ownership and hash validation, access gates, evidence requirements, and
   candidate order.
2. `OrchestrationDispatcher` plugin seam: argument arrays, capability and event
   classification, mismatch detection, cancellation, and no-shell behavior.
3. `omniskill dispatch` command seam: dry-run zero writes, JSON output, typed
   failures, receipt persistence, retry limits, approval prompts, and
   consultation suspension/resume.

Every behavioral slice follows red then green. Subprocess tests use injected
fakes; optional live Codex smoke runs under `work/` and is reported separately
from the deterministic gate. Claude remains unsupported rather than statically
presented as executable until an adapter test can run against an installed CLI.

## Acceptance Criteria

- No startup-team dispatch claims a verified model through generic
  `spawn_agent`.
- A Codex role can be planned and launched from its recorded managed profile.
- Dry-run proves the complete launch plan and writes nothing.
- Profile drift or runtime mismatch prevents task execution.
- The receipt distinguishes configured from runtime-reported evidence.
- Standard implementation access requires the explicit implementation gate.
- Retry, fallback, reassignment, and consultation limits are enforced and
  recorded.
- Unsupported Claude dispatch fails clearly without changing Claude profiles.
- Existing install, remove, and profile lifecycle behavior remains compatible.
- `rtk bun run check` passes and a scratch lifecycle smoke demonstrates
  install, dispatch dry-run, failed-closed live preflight or successful live
  launch, and removal.
