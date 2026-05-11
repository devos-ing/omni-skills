---
name: backend-standard
description: Project-agnostic backend coding standards for service architecture, integration boundaries, and reliability.
---

# Backend Coding Standard

Use this skill when implementing or reviewing backend code.

## Goals

1. Keep backend logic modular and testable.
2. Isolate external integrations from domain logic.
3. Enforce predictable error handling and observability.
4. Protect secrets and configuration boundaries.

## Structure

1. Keep configuration and environment resolution centralized.
2. Keep workflow/stage sequencing in workflow modules, not service adapters.
3. Keep external integrations isolated by provider module.
4. Keep run-state or persistence path logic in dedicated state modules.
5. Keep CLI argument parsing and command dispatch isolated from core workflow logic.
6. Avoid raw shell command construction in workflow logic; use helper modules.

## Implementation Rules

1. Validate all external input at boundaries (CLI, HTTP, webhook, queue, third-party payloads).
2. Keep service methods focused on one responsibility and explicit inputs/outputs.
3. Keep adapter/service contracts in dedicated `*.types.ts` files and avoid mixing contract declarations into runtime modules when adding or changing types.
4. Use typed interfaces for adapter contracts.
5. Prefer explicit return values over hidden shared mutable state.
6. Handle errors with context-rich messages and stable categories.
7. Add retries only for transient failures, with bounded attempts and clear logging.
8. Log key state transitions, request identifiers, and failure context without secrets.
9. Never log tokens, credentials, or private user content.
10. Keep database or filesystem operations idempotent where reruns are expected.
11. Avoid framework lock-in in core logic; keep framework-specific code near integration edges.

## Testing Expectations

1. Add unit tests for new parsing, config, and stage-transition logic.
2. Add tests for integration boundary behavior using mocks or fixtures.
3. Add regression tests for failure paths and retry behavior when changed.
4. Run repository quality gates before finalizing:
   - `bun run check`
   - `bun run typecheck`
   - `bun test`
