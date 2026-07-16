# Non-Codex Model-Role Fallback Design

## Context

Startup Team labels orchestration assignments with Codex model roles such as
`planning`, `implementation`, and `verification`. The default install targets
include Codex and Claude. Profile planning currently treats a model-role label
as a hard Codex-only restriction and aborts when it reaches Claude:

```text
Model-role routing supports Codex CLI only
```

This prevents bundle installation even though non-Codex targets already have
valid tier-based model candidates.

## Decision

Treat `modelRole` as target-specific metadata during profile planning:

- Codex uses the assignment's model-role candidate and preserves `modelRole` in
  generated instructions and profile artifacts.
- Non-Codex targets ignore the assignment's `modelRole`, select candidates from
  the assignment's existing tier, and omit `modelRole` from generated
  instructions and profile artifacts.

The workflow manifest remains unchanged. Skill installation targets remain
unchanged. Dispatch remains disabled at the public CLI boundary.

## Implementation Boundary

`planAgentProfiles` in `src/runtimes/omniskill/orchestration.ts` owns the target
decision. For each assignment and target, derive an effective model role that
is present only when the target is Codex. Use that effective value consistently
for candidate selection, generated instructions, and the planned profile.

Do not weaken Codex model-role validation, change global model-role selections,
filter out Claude profiles, or strip labels from the workflow manifest.

## User-Visible Behavior

- `omniskill install ./examples/teams/startup-team` no longer fails while
  planning Claude profiles.
- Codex profiles continue to use the configured planning, implementation, or
  verification model.
- Claude profiles continue to use their declared deep, standard, or fast tier.
- The same source assignment may therefore produce a labeled Codex profile and
  an unlabeled Claude profile.
- Profile ownership, access, consultation, fallback ordering, and installation
  transaction behavior remain unchanged.

## Test Design

Use the exported `planAgentProfiles` function as the focused public seam. Replace
the test that expects labeled Claude profiles to fail with a mixed-target test
that proves:

1. Codex preserves `modelRole` and selects the model-role candidate.
2. Claude omits `modelRole` and selects the tier candidate.
3. Claude instructions do not claim a model role.

Then rerun the minimized Startup Team planning repro with a Claude target, the
Startup Team install dry-run, focused orchestration tests, and the full
repository gate.

## Rollback

Restore the Codex-only exception in candidate selection and restore the prior
failure-expecting test. No workflow or persisted-state migration is required.
