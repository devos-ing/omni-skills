# ADHD.ai Agent Entry

This repository orchestrates multi-project agent workflows. Keep behavior project-agnostic and avoid coupling logic to a single workspace.

## Must-Follow Rules

1. Before executing agent workflow work, pull the latest code from `main` so runs start from current repository state. Fetch `origin/main`, update the local `main` with a fast-forward-only pull, and do not proceed from stale code.
2. Resolve env vars and config only in `src/config.ts`.
3. Keep stage transitions and sequencing in `src/workflow.ts`.
4. Keep integrations isolated in `src/linear.ts`, `src/github.ts`, and `src/codex.ts`.
5. Keep run-state path logic in `src/state.ts`.
6. Keep CLI parsing and dispatch in `src/args.ts` and `src/index.ts`.
7. Do not construct raw shell command strings in workflow logic; use helper modules.
8. Keep TypeScript files under 250 lines; split files before they grow beyond that limit.
9. Keep review parsing contract stable:
   - `RESULT: PASS|FAIL`
   - `SUMMARY: ...`
   - `BUGS_JSON: [...]`
10. Add tests for any new CLI flag, config shape, state path, or stage transition.

## Quality Gates

Run all checks before finalizing changes:

1. `bun run check`
2. `bun run typecheck`
3. `bun test`

## Documentation Map

- Architecture details: [ARCHITECTURE.md](/Users/roy/Desktop/SourceCode/agentic/show-me-ur-agents/ARCHITECTURE.md)
- Execution and operating plans: [docs/PLANS.md](/Users/roy/Desktop/SourceCode/agentic/show-me-ur-agents/docs/PLANS.md)
- Reliability and run behavior: [docs/RELIABILITY.md](/Users/roy/Desktop/SourceCode/agentic/show-me-ur-agents/docs/RELIABILITY.md)
- Security and secrets handling: [docs/SECURITY.md](/Users/roy/Desktop/SourceCode/agentic/show-me-ur-agents/docs/SECURITY.md)
