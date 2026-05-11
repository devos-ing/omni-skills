---
name: typescript-biome-style
description: TypeScript coding style with Biome conventions for readability, safety, and consistency.
---

# TypeScript + Biome Style

Use this skill for TypeScript implementation and review.

## Goals

1. Keep code strongly typed and self-explanatory.
2. Keep style and imports consistent through Biome.
3. Favor maintainability over cleverness.

## TypeScript Rules

1. Prefer explicit types at module boundaries (public functions, adapters, config).
2. Place interfaces and type aliases in dedicated `*.types.ts` modules and keep runtime logic in separate files when adding or modifying contracts.
3. Model domain concepts with named interfaces/types instead of loose objects.
4. Avoid `any`; use `unknown` and narrow with guards when needed.
5. Keep functions small with clear input/output contracts.
6. Use `async`/`await` for asynchronous flows and propagate typed errors.
7. Prefer immutable patterns; avoid mutating shared objects in place.
8. Keep naming descriptive and stable for variables, types, and functions.
9. Add comments only where intent is not obvious from code.

## Biome Rules

1. Respect existing formatter and linter behavior from `biome.json`.
2. Keep imports organized consistently.
3. Address linter findings directly instead of disabling rules by default.
4. Use repository scripts for validation:
   - `bun run check`
   - `bun run typecheck`
   - `bun test`

## Testing Expectations

1. Add or update tests for each behavior-changing code path.
2. Add coverage for parsing, state transitions, and config shape changes.
3. Keep tests deterministic and isolated from external systems by default.
