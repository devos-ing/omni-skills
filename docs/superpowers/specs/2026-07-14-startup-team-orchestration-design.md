# Startup Team Orchestration Design

**Date:** 2026-07-14

**Status:** Approved for specification review

**Decision owner:** `startup-goal` coordinator

## Summary

Add a global, runtime-native orchestration layer to `startup-team`. The layer
maps startup roles and task classes to vendor-neutral capability tiers, compiles
those tiers into native Codex and Claude agent profiles, and manages the
profiles through the existing Omniskills install and removal lifecycle.

The three capability tiers are:

- `deep` for orchestration support, strategy, planning, architecture,
  implementation framing, and difficult review.
- `standard` for implementation and ordinary corrective work.
- `fast` for explicitly routine, read-only exploration, summarization, and
  mechanical checks.

The design does not add a persistent process supervisor. Codex runs Codex
agents, Claude runs Claude agents, and the native runtime remains responsible
for spawning and messaging.

## Problem

`startup-team` currently routes work by role but does not install a portable
model policy. Users must choose models manually, cannot see one consistent
quality-versus-cost contract across Codex and Claude, and have no bounded
protocol for a child agent to ask the orchestrator for advice.

The desired behavior is:

1. Use strong reasoning for thinking, planning, and high-risk review.
2. Use a normal coding model for implementation.
3. Use a faster model only for explicitly routine work.
4. Make retries, fallbacks, reassignment, and consultations visible and finite.
5. Preserve every existing human approval gate.

## Approved Scope

### Must have

- One user-owned global configuration at
  `~/.omniskills/orchestration.json`.
- An optional, reusable `orchestration` declaration for team manifests.
- Deterministic Codex and Claude profile compilation.
- Globally namespaced native profiles under `~/.codex/agents/` and
  `~/.claude/agents/`.
- Complete zero-write install dry-run output.
- Idempotent install, config-driven update, collision protection, drift
  detection, ownership-aware removal, and legacy install-record compatibility.
- Bounded same-tier retry and fallback with visible disclosure.
- Human approval before any tier downgrade, scope expansion, or gate bypass.
- Limited child-to-orchestrator consultation.
- A live Codex smoke check and static Claude validation.

### Not in v1

- Codex-to-Claude or Claude-to-Codex spawning.
- A standalone CLI supervisor or background daemon.
- Automatic vendor CLI installation or authentication.
- Editing vendor entitlement or organization model allowlists.
- Cost dashboards, usage accounting, or interactive configuration UI.
- Unbounded recursive agent delegation.
- Provider-level failover guarantees.

## Honest Enforcement Boundaries

These boundaries are product requirements.

1. Invoking `$startup-goal` cannot change the model of an already-running root
   Codex or Claude session. The root must already use the desired model, activate
   a native orchestrator profile where the runtime supports that flow, or
   delegate demanding reasoning to generated `deep` agents.
2. Same-tier fallback is an orchestrator retry after an observable spawn or
   execution failure. It is not provider-level automatic failover.
3. Consultation is a native messaging protocol when the runtime exposes the
   needed tool. When it does not, the child returns the same structured request
   as its result and stops so the parent can decide what happens next.
4. Codex behavior receives a live smoke test in the current environment. Claude
   profiles receive static shape and semantic validation until Claude Code is
   separately installed and authenticated.

The CLI and documentation must never describe statically configured or
best-effort behavior as runtime-verified enforcement.

## Domain Model

### `OrchestrationSpec`

Bundle-owned policy that maps declared role and support-agent sources to a
capability tier, access mode, and consultation permission. It contains no vendor
model identifiers.

### `TierMap`

User-owned mapping from `deep`, `standard`, and `fast` to ordered Codex and
Claude model candidates.

### `AgentProfilePlan`

Pure, deterministic output describing every desired profile, destination,
content hash, ownership identity, selected tier, and collision status.

### `ManagedProfile`

A generated native Codex TOML or Claude Markdown agent profile owned by one
installed team record.

### `ConsultationRequest`

A bounded child request for an orchestration decision. Its trigger is one of
`ambiguity`, `requirement_conflict`, `elevated_risk`, or
`failed_verification`.

## Team Manifest Contract

Team manifests may add an optional `orchestration` object. The feature must be
generic and must not special-case `startup-team` in the runtime.

Conceptual shape:

```json
{
  "orchestration": {
    "roles": {
      "./skills/startup-goal": {
        "tier": "deep",
        "access": "read-only",
        "consultation": "receive"
      },
      "catalog:cto": {
        "tier": "deep",
        "access": "read-only",
        "consultation": "request"
      },
      "mattpocock:implement": {
        "tier": "standard",
        "access": "workspace-write",
        "consultation": "request"
      }
    },
    "support": {
      "explorer": {
        "tier": "fast",
        "access": "read-only",
        "consultation": "request"
      }
    }
  }
}
```

Requirements:

- Every role source must match a declared skill or resolved team member.
- `startup-goal` is the only consultation receiver for `startup-team`.
- Workspace-write access is limited to the explicit implementation phase.
- Support agents are optional and cannot become undeclared team members.
- Unknown tiers, access modes, consultation modes, or sources fail manifest
  validation.

## Global Configuration Contract

When no configuration exists, dry-run displays the defaults and installation
creates them once. A valid existing file is always preserved and becomes the
only model-mapping source.

Default conceptual configuration:

```json
{
  "schemaVersion": "0.1",
  "tiers": {
    "deep": {
      "codex": [
        { "model": "gpt-5.6", "reasoningEffort": "high" }
      ],
      "claude": [
        { "model": "opus", "effort": "high" }
      ]
    },
    "standard": {
      "codex": [
        { "model": "gpt-5.6", "reasoningEffort": "medium" }
      ],
      "claude": [
        { "model": "sonnet", "effort": "medium" }
      ]
    },
    "fast": {
      "codex": [
        { "model": "gpt-5.6-terra", "reasoningEffort": "low" }
      ],
      "claude": [
        { "model": "haiku", "effort": "low" }
      ]
    }
  },
  "limits": {
    "retryPerCandidate": 1,
    "reassignmentPerWorkItem": 1,
    "consultationsPerAgent": 2
  },
  "policy": {
    "sameTierFallback": "automatic_disclosed",
    "lowerTierFallback": "human_approval"
  }
}
```

Model names and supported effort values are runtime-dependent. The compiler
validates the configuration shape and supported adapter vocabulary; actual
model entitlement and availability remain runtime checks.

Validation rejects:

- Unknown schema versions or tiers.
- Missing or empty vendor candidate lists.
- Duplicate candidates within one tier and vendor.
- Unknown reasoning or effort values.
- Zero, negative, non-integer, or unbounded limits.
- A policy that permits silent lower-tier fallback.

Removal always preserves this user-owned configuration.

## Native Profile Compilation

Profile names use this pattern:

```text
omniskills-<team-name>-<role-or-support-id>
```

Examples:

```text
~/.codex/agents/omniskills-startup-team-cto.toml
~/.claude/agents/omniskills-startup-team-cto.md
```

If a tier contains multiple candidates, the compiler emits deterministic
candidate profile IDs such as `-fallback-2`. The primary profile is always the
first configured candidate.

Every generated profile includes:

- Team and role identity.
- Matching installed skill instructions.
- Model and reasoning or effort configuration.
- Read-only or workspace-write intent.
- Runtime-native-only restriction.
- Consultation triggers and request schema.
- Human-gate prohibitions.
- Retry, fallback, and reassignment limits.
- A generated ownership marker that is not treated as sufficient proof for
  deletion without the install record and content hash.

Codex output uses standalone agent TOML. Claude output uses agent Markdown with
YAML frontmatter. Claude profiles include `SendMessage` when consultation is
allowed and deny nested `Agent` spawning. Codex profiles receive equivalent
bounded-delegation instructions and must not expand global nesting depth.

## Consultation Protocol

A child may consult only for one approved trigger. The request is:

```text
trigger: ambiguity | requirement_conflict | elevated_risk | failed_verification
current_task: concise work item
evidence: observed facts or failed attempt
decision_needed: one decision
recommendation: child's preferred next action
```

The orchestrator returns one disposition:

- `continue`
- `retry`
- `reassign`
- `escalate_to_human`

Rules:

- Routine implementation continues without consultation.
- Repeating the same unresolved request without new evidence reuses or rejects
  the prior decision.
- A child gets at most two consultations in one run.
- Agent messages cannot authorize expanded scope, tier downgrade, permission
  changes, or approval-gate bypass.
- An unresolved request after the limit escalates to the human.

## Installation and Update Flow

```text
Resolve team and direct orchestration declaration
  -> read or propose global TierMap
  -> validate manifest and config
  -> compile all profiles in memory
  -> preflight every destination
  -> stop on blocking conflict
  -> install existing skill artifacts
  -> atomically write the profile batch
  -> write the root team install record after success
```

Profile preflight happens before any known profile write. A temporary file and
rename strategy makes each profile replacement atomic, and the adapter rolls
back files created earlier in the same profile batch if a later profile write
fails.

This does not claim a transaction across every pre-existing skill installation
side effect. Whole-install transactionality remains separate follow-up work.
The install record is never written until the existing skill phase and new
profile phase both succeed.

## Dry Run

`omniskill install <source> --dry-run` performs validation, compilation, and
collision preflight but does not:

- Create the global configuration.
- Bootstrap or install external skills.
- Create or update profiles.
- Write an install record.
- Remove any artifact.

Output lists every target, destination, profile ID, role or task class, tier,
primary model, effort, ordered fallback candidates, ownership state, and planned
status.

Statuses are:

- `create`
- `unchanged`
- `update`
- `conflict`
- `keep`
- `remove`

An unmanaged exact-path collision makes the plan non-installable. Repeated
dry-runs against unchanged state produce identical output.

## Ownership, Collision, and Removal

The root team install record stores, for every profile:

- Artifact kind.
- Target runtime.
- Profile ID.
- Absolute destination.
- Owning workflow identity.
- Installed content hash.

Behavior:

- A foreign exact-path file is never overwritten automatically.
- An unchanged profile owned by the same installation is eligible for an
  idempotent update.
- A drifted managed profile is preserved and reported as a conflict unless the
  user explicitly requests overwrite.
- Update rewrites only affected, unchanged managed profiles.
- Removal deletes only recorded, unchanged, exclusively owned profiles.
- Drifted, foreign, or shared profiles are retained with recovery guidance.
- Removing `startup-team` does not remove independently installed role
  workflows or the global orchestration configuration.
- Legacy skill-only install records remain valid without migration writes.

## Module Boundaries

### `src/runtimes/omniskill/orchestration.ts`

Owns Zod schemas, normalization, role resolution, tier candidate ordering, pure
profile planning, and deterministic target rendering inputs. It performs no
filesystem writes.

### `src/plugins/agent-profile-installer.ts`

Owns Codex and Claude destinations, collision classification, filesystem
preflight, atomic writes, rollback within the profile batch, hashes, drift
checks, and removal actions. It contains no team-routing rules.

### `src/runtimes/omniskill/workflow-bundles.ts`

Owns the optional manifest declaration, backward-compatible install-record
shape, and ownership-aware removal plan integration.

### `src/omniskill.ts`

Owns command orchestration and output. It calls the runtime and plugin
interfaces but does not absorb schema, compilation, or target-write rules.

### `src/cli.ts`

Remains a thin Commander shell. It exposes `--dry-run` through the existing
command-registration seam and delegates behavior.

## Error Handling

- Invalid manifest or global configuration fails before profile or config
  writes and identifies the invalid field.
- Any preflight conflict is reported before the profile batch starts.
- An unavailable primary model may trigger the next same-tier profile only
  after the runtime reports an observable failure.
- Exhausting configured candidates stops and asks for human approval; it never
  silently selects another tier.
- Missing runtime evidence never produces a successful-fallback claim.
- A failed profile batch rolls back files created or replaced by that batch and
  does not write the install record.
- A missing consultation transport returns the structured consultation request
  to the parent instead of pretending advice was delivered.

## Verification Strategy

### Focused tests

- Manifest and configuration validation.
- Default configuration and preservation of user configuration.
- Deterministic Codex and Claude rendering.
- Role-to-tier and access-mode mapping.
- Dry-run purity and deterministic output.
- Create, unchanged, update, foreign collision, drift collision, and explicit
  overwrite.
- Batch rollback and no install-record write after failure.
- Legacy install-record compatibility.
- Shared-artifact and modified-artifact removal behavior.
- Retry, same-tier fallback, reassignment, consultation, duplicate-request, and
  human-downgrade gates.

### Smoke checks

All filesystem smoke checks use a unique scratch home under `work/`; they do not
touch the user's real global profiles.

1. `rtk bun run dev -- install examples/teams/startup-team --dry-run`
2. `rtk bun run dev -- validate examples/teams/startup-team`
3. `rtk bun run dev -- deps examples/teams/startup-team`
4. Scratch-home installation and static parsing of every generated profile.
5. Live Codex discovery, deep planning dispatch, standard implementation
   dispatch, one permitted consultation, visible same-tier fallback attempt,
   and blocked lower-tier downgrade.
6. Static Claude profile parsing and policy-semantic assertions.
7. `rtk bun run check`

The final report must state that Claude runtime behavior was not live-verified.

## Delivery Sequence

1. Add red tests for the manifest and global configuration contracts.
2. Implement the pure orchestration schema and profile planner.
3. Add deterministic renderer fixtures for Codex and Claude.
4. Add red temp-home tests for profile lifecycle and batch rollback.
5. Implement the target profile installer.
6. Integrate preflight, `--dry-run`, installation, output, and install records.
7. Extend ownership-aware removal while preserving legacy records.
8. Add `startup-team` orchestration metadata and coordinator instructions.
9. Regenerate the startup-team lock and update documentation.
10. Run focused checks, smoke checks, the full repository gate, and a diff
    review against the captured pre-change fixed point.

No new npm dependency is required. Any later dependency proposal must pass the
repository's package-recency check before approval.

## Acceptance Criteria

The feature is complete when:

- One global install produces deterministic namespaced Codex and Claude
  profiles from the same validated configuration.
- Dry-run shows the complete plan and leaves the filesystem unchanged.
- Reinstall is idempotent, config changes update only affected managed files,
  and foreign or drifted files are preserved.
- Removal deletes only unchanged, exclusively owned profiles and preserves the
  shared configuration.
- Dispatch traces disclose task, tier, runtime, selected model, effort, and
  fallback attempts.
- Same-tier retry and fallback are finite and lower-tier fallback stops at a
  human gate.
- Consultation uses only the four approved triggers and cannot create an advice
  loop or bypass authority.
- Codex smoke evidence, Claude static evidence, startup-team smoke checks, and
  `rtk bun run check` all pass.

## Decision Log

- Product Manager: the must-have product slice is safe global lifecycle plus
  visible, bounded routing; dashboards and cross-vendor execution are polish or
  later work.
- CTO: compile portable policy into native profiles through a pure runtime
  module and a separate target-writer plugin; do not claim a new supervisor.
- Engineering Manager: deliver one vertical slice through reversible,
  test-first checkpoints and preserve a verifiable repository state after each
  checkpoint.
- Human owner: approved runtime-native Codex and Claude support, global
  installation, capability tiers, limited consultation, human downgrade gates,
  and the documented enforcement boundaries.
