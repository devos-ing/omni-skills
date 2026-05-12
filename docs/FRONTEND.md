# Frontend

This repository currently has no user-facing frontend application in this branch (`packages/cli` only).

Operator surfaces are CLI output, Linear comments, and GitHub PR metadata. If a frontend is introduced, document:

1. user workflows and personas
2. API boundaries
3. reliability and auth model
4. deployment and rollback strategy

## Local Commands (Workspace Scripts)

- `bun run dev:web`: reserved workspace command for the ROY-120 web package dev server
- `bun run dev:server`: reserved workspace command for the ROY-120 API server dev process
- `bun run dev`: reserved combined entrypoint for local server/web startup
- `bun run build:web`: reserved workspace web build command
- `bun run build:server`: reserved workspace API server build command

These commands are present at the root and currently print status messages until server/web packages are added.
