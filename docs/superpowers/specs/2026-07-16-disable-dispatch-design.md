# Disable CLI Dispatch While Preserving Bundles

## Context

The orchestration dispatch path can cause increasing memory usage. Users must
not be able to start or resume dispatch runs until that issue is resolved.
Workflow and team bundles remain useful independently and must continue to
validate, install, list, and remove normally.

## Decision

Stop registering the public `omniskill dispatch` command, including its nested
`resume` path. Keep the dispatch runtime, dispatcher adapters, run store, bundle
schemas, orchestration metadata, and model-routing setup code in place but
dormant. This gives the memory-risking execution path one clear off switch and
keeps rollback small.

`setup-model-routing` remains registered. It does not launch dispatch work, and
retaining it preserves compatibility with installed bundle profile metadata.

## User-Visible Behavior

- `omniskill --help` does not list `dispatch`.
- Calling `omniskill dispatch ...` fails as an unknown command before any
  dispatcher, run store, child process, or run-state write can occur.
- `init`, `validate`, `lock`, `deps`, `install`, `list`, `remove`, `onboard`,
  `setup-model-routing`, and `loop` retain their current behavior.
- Existing installed bundles and existing dispatch run files are not modified
  or deleted.
- Architecture documentation describes dispatch as temporarily disabled rather
  than as an available command.

## Implementation Boundary

The CLI registration seam in `src/omniskill.ts` is the off switch. Remove the
call that registers dispatch from the normal Omniskills command setup. Do not
delete or rewrite the dormant dispatch functions and modules in this change.
This keeps the change isolated from bundle installation and avoids mixing a
memory-safety mitigation with a larger runtime removal.

## Test Design

Use the public CLI command tree as the primary seam:

1. Assert that `dispatch` is absent from the Omniskills command list.
2. Assert that parsing a dispatch invocation rejects it as an unknown command.
3. Retain existing install, validation, dependency, and model-routing tests to
   guard the preserved bundle surface.

Run the focused CLI tests first, then the repository gate and CLI smoke checks.

## Rollback

Re-register the existing dispatch command in the Omniskills command setup and
restore the corresponding help documentation. No runtime reconstruction or
state migration is required because the implementation and stored runs remain
untouched.
