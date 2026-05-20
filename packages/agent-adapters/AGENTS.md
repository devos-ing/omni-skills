# Agent Adapters Package Instructions

This package owns runtime adapters that execute external coding agents for
devos.ing workflow stages.

## Rules

1. Keep adapter contracts in dedicated `*.types.ts` modules.
2. Keep provider code free of workflow, Linear, GitHub, database, and run-state
   logic.
3. Build runtime invocations as structured command and argument arrays.
4. Normalize provider output into `AgentResult`.
5. Add focused tests for provider parsing and command argument construction.
6. Keep provider-specific files grouped by folder, such as `src/codex/*` and
   `src/claude/*`.
7. Keep provider folders consistent: `adapter.ts`, `constants.ts`,
   `configuration-doc.ts`, and `index.ts`.
8. Keep shared backend/model metadata in `src/registry.ts` and
   `src/agent-registry.types.ts`.
9. Keep TypeScript files under 250 lines.
