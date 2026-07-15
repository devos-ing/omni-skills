# Codex Model-Role Routing Design

**Date:** 2026-07-15
**Status:** Approved for implementation planning
**Scope:** CLI-first global Codex model routing for Omniskills teams

## Summary

Omniskills will let users choose one Codex model and reasoning effort for each
of three global work categories:

- `planning` for thinking, research, and planning
- `implementation` for workspace-writing execution
- `verification` for QA and testing

Team manifests will label each orchestration assignment with `modelRole` so
profile generation and dispatch can resolve the correct global selection.
Existing `tier`, `access`, and `consultation` fields remain independent policy
controls. A new callable `$setup-model-routing` skill will guide the user
through the selections and invoke a deterministic CLI writer after explicit
confirmation.

Codex CLI is the only model-role execution runtime in v1. Claude model-role
routing and an MCP control surface are explicitly deferred.

## Goals

- Make planning, implementation, and verification model choices explicit.
- Store those choices globally rather than per team or per agent.
- Discover models from the signed-in Codex CLI identity.
- Offer only reasoning efforts supported by the selected model.
- Apply changes safely to managed profiles and installed workflow records.
- Preserve existing tier, permission, consultation, retry, and fallback rules.
- Keep legacy manifests and global configuration working without silent
  rewrites.

## Non-Goals

- Claude model discovery or Claude model-role dispatch in v1.
- An MCP server or remote orchestration API.
- Per-team or per-agent model overrides.
- Automatic model prompts during `omniskill install`.
- Changes to workspace-write approval, consultation, retry, or tier policy.
- User-authored fallback-chain editing in the first setup experience.

## Decisions

### `modelRole` selects models, not permissions

`modelRole` answers which global model selection should run the work. It does
not replace `tier`, `access`, or `consultation`:

- `tier` remains the capability and downgrade policy label.
- `access` remains the filesystem permission boundary.
- `consultation` remains the coordination contract.
- `modelRole` resolves to an ordered Codex model candidate list.

Dispatch plans and receipts will disclose all four dimensions so users can see
both policy and actual routing.

### One manifest source of truth

`modelRole` lives on `orchestration.roles` and `orchestration.support`
assignments. It is not duplicated on workflow steps. A step already names its
skill, which identifies its orchestration assignment, so duplicating the field
would create a mismatch state without adding routing information.

Validation follows the existing skill reference:

- A `phase: "implementation"` step must resolve to an assignment whose
  `modelRole` is `implementation` when the label is present.
- A `workspace-write` assignment must use `modelRole: "implementation"` when
  the label is present.
- The coordinator must use `modelRole: "planning"` when the label is present.
- Manifests without `modelRole` remain valid and retain tier-based routing.

### CLI remains the control plane

The existing runtime modules and CLI remain the source of truth. The setup
skill is a guided entrypoint, not a second implementation of configuration
logic. An MCP server may later expose the same runtime functions for live
`dispatch`, `status`, `cancel`, and `resume` tools, but will not be part of this
change.

## Manifest Contract

Add the optional enum `modelRole` to every orchestration assignment:

```json
{
  "orchestration": {
    "roles": {
      "catalog:cto": {
        "tier": "deep",
        "modelRole": "planning",
        "access": "read-only",
        "consultation": "request"
      },
      "mattpocock:implement": {
        "tier": "standard",
        "modelRole": "implementation",
        "access": "workspace-write",
        "consultation": "request"
      },
      "catalog:qa-lead": {
        "tier": "deep",
        "modelRole": "verification",
        "access": "read-only",
        "consultation": "request"
      }
    },
    "support": {
      "explorer": {
        "tier": "fast",
        "modelRole": "planning",
        "access": "read-only",
        "consultation": "request"
      }
    }
  }
}
```

The startup-team mapping is fixed as follows:

| Assignment | `modelRole` |
| --- | --- |
| `./skills/startup-goal` | `planning` |
| `catalog:ceo` | `planning` |
| `catalog:cto` | `planning` |
| `catalog:product-manager` | `planning` |
| `catalog:web-design` | `planning` |
| `catalog:engineering-manager` | `planning` |
| `catalog:founding-engineer` | `planning` |
| `mattpocock:implement` | `implementation` |
| `catalog:qa-lead` | `verification` |
| support `explorer` | `planning` |

The manifest schema continues to accept omitted `modelRole` for compatibility.
Checked-in `startup-team` will declare every label explicitly.

## Global Configuration

The global file remains `~/.omniskills/orchestration.json`. Schema `0.2`
retains the existing `tiers` block for legacy manifests and existing Claude
profile generation, then adds Codex-only model-role selections:

```json
{
  "schemaVersion": "0.2",
  "tiers": {
    "deep": {
      "codex": [{ "model": "gpt-5.5", "reasoningEffort": "high" }],
      "claude": [{ "model": "opus", "effort": "high" }]
    },
    "standard": {
      "codex": [{ "model": "gpt-5.5", "reasoningEffort": "medium" }],
      "claude": [{ "model": "sonnet", "effort": "medium" }]
    },
    "fast": {
      "codex": [{ "model": "gpt-5.5", "reasoningEffort": "low" }],
      "claude": [{ "model": "haiku", "effort": "low" }]
    }
  },
  "modelRoles": {
    "planning": {
      "codex": [{ "model": "gpt-5.5", "reasoningEffort": "high" }]
    },
    "implementation": {
      "codex": [{ "model": "gpt-5.5", "reasoningEffort": "medium" }]
    },
    "verification": {
      "codex": [{ "model": "gpt-5.5", "reasoningEffort": "high" }]
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

The runtime will parse file content into an internal effective configuration:

- Schema `0.2` uses `modelRoles` for labeled Codex assignments.
- Schema `0.1` remains valid. Its effective compatibility mapping is
  `planning -> deep.codex`, `implementation -> standard.codex`, and
  `verification -> deep.codex`.
- Unlabeled assignments continue to use their existing tier candidates.
- Installation never rewrites a custom `0.1` or `0.2` file merely because it
  can derive an effective configuration.
- The explicit setup command may upgrade `0.1` to `0.2` after confirmation,
  preserving its tiers, limits, policy, and existing candidate ordering.

## Setup Experience

`$setup-model-routing` is a callable skill shipped as a reusable public
workflow and included as a non-member dependency of `startup-team`. It guides
the following flow:

1. Explain that selections are global and Codex-only in v1.
2. Read the current effective routing without modifying it.
3. Discover the signed-in identity's visible models through the existing
   `codex debug models` provider seam.
4. For `planning`, `implementation`, then `verification`, ask for a model and
   show only that model's supported reasoning efforts.
5. Show the three proposed selections plus the affected managed profiles.
6. Wait for explicit confirmation.
7. Invoke the deterministic CLI setup operation with the selected values.
8. Report the updated config path, regenerated profiles, and any teams that
   require manual attention.

The CLI operation will support a dry-run JSON plan so the skill does not need
to reimplement validation or filesystem planning. Cancellation before final
confirmation produces no writes.

### CLI contract

The skill calls one deterministic command surface:

```bash
omniskill setup-model-routing --list-models --json

omniskill setup-model-routing \
  --planning-model <slug> --planning-effort <effort> \
  --implementation-model <slug> --implementation-effort <effort> \
  --verification-model <slug> --verification-effort <effort> \
  --dry-run --json

omniskill setup-model-routing \
  --planning-model <slug> --planning-effort <effort> \
  --implementation-model <slug> --implementation-effort <effort> \
  --verification-model <slug> --verification-effort <effort> \
  --apply --json
```

`--list-models` is read-only and returns visible model slugs with supported
efforts. Selection mode requires all six model/effort flags. Exactly one of
`--dry-run` or `--apply` is required, so a partial or accidental invocation
cannot write. The skill owns the conversational prompts and confirmation; the
CLI owns discovery, validation, planning, atomic mutation, and machine-readable
results.

## Atomic Update Boundary

Changing the global configuration alone is insufficient because installed
profiles embed model and effort. The setup operation therefore plans one
transaction across:

- `~/.omniskills/orchestration.json`
- managed Codex profiles for installed labeled teams
- installed workflow records whose profile artifacts change

Before writing, it must validate the complete Codex catalog compatibility and
classify every profile write as create, unchanged, update, or conflict. Any
unmanaged conflict, unavailable model, unsupported effort, malformed existing
configuration, or invalid installed record aborts the operation before writes.

Writes use the existing profile installer rollback boundary extended to the
configuration and installed records. If a write fails, all files already
changed by this operation are restored. User-modified managed profiles are
never overwritten automatically.

## Profile and Dispatch Data

Managed profile artifacts add `modelRole` alongside the existing tier, model,
effort, access, instructions, consultation, limits, and candidate metadata.
Codex profile candidates are selected from `modelRoles[assignment.modelRole]`
for labeled assignments and from `tiers[assignment.tier]` for legacy ones.

Dispatch plans, attempts, and receipts add `modelRole`. Dispatch verifies that
the installed profile metadata and content hash still match before launch.
JSON and human-readable dry-run output disclose:

- role source
- `modelRole`
- tier
- runtime and adapter
- model and effort
- access
- candidate position
- evidence capability

A labeled assignment dispatched with `--runtime claude` fails before launch
with an explicit Codex-only model-role error. Legacy unlabeled Claude profiles
continue to use the existing tier path.

## Failure Handling

- Model discovery failure: stop before presenting writable selections.
- Unavailable model or unsupported effort: reject before confirmation or write.
- Invalid global configuration: report the validation path and preserve bytes.
- User cancellation: return a cancelled result with no writes.
- Profile ownership conflict: show affected paths and stop before writes.
- Partial filesystem failure: roll back config, profiles, and installed records.
- Missing model-role setup: use legacy effective defaults for a legacy `0.1`
  configuration; do not silently invent settings for malformed data.
- Claude model-role request: fail before launch with a deliberate unsupported
  runtime error.
- Dispatch drift: retain the current reinstall/setup guidance and do not launch.

## Testing Strategy

Implementation is test-first in these slices:

1. Manifest schema and startup-team mapping in
   `tests/workflow-bundles.test.ts`.
2. Config `0.2`, effective `0.1` compatibility, catalog filtering, and profile
   planning in `tests/orchestration.test.ts` and
   `tests/codex-model-catalog.test.ts`.
3. Config/profile/record preflight and rollback in
   `tests/agent-profile-installer.test.ts`.
4. Plan, attempt, receipt, resume, fallback, drift, and Codex-only checks in
   `tests/orchestration-dispatch.test.ts` and
   `tests/orchestration-run-store.test.ts`.
5. Setup command, cancellation, dry-run JSON, non-interactive install, and
   startup-team integration in `tests/omniskill.test.ts`.
6. Skill/package contract coverage in `tests/workflow-bundles.test.ts` and the
   existing public-example contract tests.

Required verification:

```bash
rtk bun test tests/workflow-bundles.test.ts
rtk bun test tests/orchestration.test.ts tests/codex-model-catalog.test.ts
rtk bun test tests/agent-profile-installer.test.ts
rtk bun test tests/orchestration-dispatch.test.ts tests/orchestration-run-store.test.ts tests/orchestration-dispatcher.test.ts
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- deps examples/teams/startup-team
rtk bun run check
```

## Rollout

1. Land schema and effective-config support without changing public manifests.
2. Land setup planning and atomic update behavior.
3. Add the reusable setup skill and CLI invocation.
4. Label `startup-team`, regenerate its lock file, and update its documentation.
5. Run focused tests, CLI smoke checks, and the full repository gate.

## Decision Log

| Decision | Owner | Evidence |
| --- | --- | --- |
| Global rather than per-team settings | User | Explicit approval |
| Codex CLI execution first | User | Explicit approval |
| Three labels: planning, implementation, verification | User | Explicit approval |
| `modelRole` field name and assignment mapping | User | Selected recommended approach |
| Explicit setup skill; no install prompt | User | Explicit approval |
| Preserve tier/access/consultation as separate policy | CTO | Verified architecture dispatch |
| Keep one manifest source of truth on assignments | Root synthesis | Avoids duplicated step state while preserving validation |
| CLI-first; MCP deferred | User | Explicit approval |
| Test-first implementation through the existing orchestration spine | Founding engineer | Verified implementation-frame dispatch |

## Approval Gates

- This design must be reviewed by the user before implementation planning.
- The implementation plan must be reviewed before workspace-write dispatch.
- The `implement` dispatch requires explicit `--approve-workspace-write`.
- QA must independently verify focused tests, smoke checks, and
  `rtk bun run check` before completion is claimed.
