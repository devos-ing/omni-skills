# Projects Repo Emoji Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Projects a first-class operator page with a platform-matching table UI, persisted emoji metadata, and a hybrid GitHub repository selector.

**Architecture:** Extend the existing project data contract instead of creating a new project model. Add a narrow server GitHub repository route backed by structured `gh` command arguments, then consume it through the existing web API/query layers. Keep UI changes in the current `projects` component folder and reuse the operator shell, table, dialog, button, input, and typography patterns.

**Tech Stack:** Bun, Next.js, React Query, TypeScript, Drizzle schema, server route handlers, `emoji-picker-react`, GitHub CLI.

---

### Task 1: Persist Project Emoji

**Files:**
- Modify: `packages/db/src/schema/board-projects.schema.ts`
- Create: `packages/db/src/migrations/0020_project_emoji.sql`
- Modify: `packages/db/src/migrations.ts`
- Modify: `packages/server/src/types/app.types.ts`
- Modify: `packages/server/src/http/types/project-task-api.types.ts`
- Modify: `packages/server/src/http/project-task-schemas.ts`
- Modify: `packages/server/src/projects/project-service.ts`
- Modify: `packages/server/src/board-read-models.ts`
- Modify: `packages/server/src/repositories.ts`
- Modify: `packages/server/src/realtime/types/realtime-events.types.ts`
- Modify: `packages/server/src/realtime/realtime-mappers.ts`
- Modify: `packages/web/src/lib/api/types/client.types.ts`
- Modify: `packages/web/src/lib/api/board-client.ts`
- Modify: `packages/web/src/lib/realtime/realtime-event-parser.ts`
- Tests: `packages/server/tests/request-schemas.test.ts`, `packages/server/tests/project-routes.test.ts`, `packages/web/tests/project-client.test.ts`

- [ ] **Step 1: Write failing tests for emoji payloads**

Add assertions that project create accepts `emoji: "🧭"` and returns/parses the same emoji.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `bun test packages/server/tests/request-schemas.test.ts packages/server/tests/project-routes.test.ts packages/web/tests/project-client.test.ts`

Expected: tests fail because `emoji` is not part of the API/database contract.

- [ ] **Step 3: Add the emoji column and contract fields**

Add nullable `emoji` string fields to database schema, migration list, server project types, realtime mappers, and web client parsers.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `bun test packages/server/tests/request-schemas.test.ts packages/server/tests/project-routes.test.ts packages/web/tests/project-client.test.ts`

Expected: tests pass.

### Task 2: Add GitHub Repository Discovery API

**Files:**
- Create: `packages/server/src/http/types/github-repositories-api.types.ts`
- Create: `packages/server/src/http/github-repositories-routes.ts`
- Modify: `packages/server/src/http/app-routes.ts`
- Create: `packages/server/tests/github-repositories-routes.test.ts`
- Modify: `packages/web/src/lib/api/types/client.types.ts`
- Modify: `packages/web/src/lib/api/board-client.ts`
- Modify: `packages/web/src/lib/api/client.ts`
- Modify: `packages/web/src/lib/api/index.ts`
- Modify: `packages/web/src/lib/api/query-keys.ts`
- Modify: `packages/web/src/lib/api/realtime-queries.ts`
- Create: `packages/web/tests/github-repositories-client.test.ts`

- [ ] **Step 1: Write failing route and client tests**

Test that the server maps `gh repo list --limit 100 --json nameWithOwner,defaultBranchRef,isPrivate` output into repository options and returns an unavailable response when `gh` fails. Test that the web client parses the response.

- [ ] **Step 2: Run focused tests and confirm RED**

Run: `bun test packages/server/tests/github-repositories-routes.test.ts packages/web/tests/github-repositories-client.test.ts`

Expected: tests fail because the route and client methods do not exist.

- [ ] **Step 3: Implement narrow server route and web client query**

Use `runCommand("gh", args, { cwd: workspacePath })` with structured args only. Return `{ repositories, isAvailable, unavailableReason }`.

- [ ] **Step 4: Run focused tests and confirm GREEN**

Run: `bun test packages/server/tests/github-repositories-routes.test.ts packages/web/tests/github-repositories-client.test.ts`

Expected: tests pass.

### Task 3: Update Projects UI

**Files:**
- Modify: `packages/web/package.json`
- Modify: `bun.lock`
- Modify: `packages/web/src/components/web-shell/web-shell.constants.ts`
- Modify: `packages/web/src/components/projects/types/projects-panel.types.ts`
- Modify: `packages/web/src/components/projects/projects-panel-utils.ts`
- Modify: `packages/web/src/components/projects/project-create-dialog.tsx`
- Modify: `packages/web/src/components/projects/projects-panel.tsx`
- Modify: `packages/web/src/components/projects/projects-table.tsx`
- Tests: `packages/web/tests/projects-panel-utils.test.ts`

- [ ] **Step 1: Install `emoji-picker-react` with Bun**

Run: `bun add --filter web emoji-picker-react`

- [ ] **Step 2: Write failing helper tests**

Update `projects-panel-utils` tests for manual `owner/repo`, selected repo option, default emoji, and display-row emoji label.

- [ ] **Step 3: Run focused web helper tests and confirm RED**

Run: `bun test packages/web/tests/projects-panel-utils.test.ts`

Expected: tests fail because the form model still expects repository URLs and has no emoji.

- [ ] **Step 4: Implement the platform-matching UI**

Unhide Projects in navigation, update the table to match the Agents-style operator surface, and update the create dialog with emoji picker, title, description, discovered repo select, and manual repo fallback.

- [ ] **Step 5: Run focused web tests and confirm GREEN**

Run: `bun test packages/web/tests/projects-panel-utils.test.ts packages/web/tests/project-client.test.ts packages/web/tests/github-repositories-client.test.ts`

Expected: tests pass.

### Task 4: Verify

**Files:**
- No new files.

- [ ] **Step 1: Run package checks**

Run:
- `bun run --filter devos-db typecheck`
- `bun run --filter devos-server typecheck`
- `bun run --filter web typecheck`
- `bun run --filter web build`

- [ ] **Step 2: Run app browser verification**

Run `bun run --filter web dev` and inspect `/projects` in the browser at desktop and narrow widths.

- [ ] **Step 3: Run final status**

Run: `git status --short --branch`

Expected: changed files match the project page, project API, database migration, dependency, and plan artifacts only.
