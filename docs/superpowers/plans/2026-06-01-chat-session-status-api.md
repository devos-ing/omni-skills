# Chat Session Status API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `GET /api/chat/sessions/{id}/status` returning `running`, `idle`, or `archived`.

**Architecture:** Add a focused chat status contract under `packages/server/src/chat/types`, resolve the status through the chat repository/service, and route it from the existing chat HTTP module. Running status comes from the latest linked task execution log; archive status comes from the session row.

**Tech Stack:** Bun tests, TypeScript, Drizzle through `devos-db`, existing server route helpers, OpenAPI YAML.

---

### Task 1: Route Test

**Files:**
- Create: `packages/server/tests/chat-session-status-routes.test.ts`

- [ ] **Step 1: Write the failing test**

Add a test that seeds four sessions: idle with no execution, running with latest execution `running`, archived, and a missing id request. The expected responses are:

```typescript
expect(await idleResponse.json()).toEqual({
	sessionId: "session-idle",
	taskId: "task-idle",
	status: "idle",
});
expect(await runningResponse.json()).toEqual({
	sessionId: "session-running",
	taskId: "task-running",
	status: "running",
});
expect(await archivedResponse.json()).toEqual({
	sessionId: "session-archived",
	taskId: "task-archived",
	status: "archived",
});
expect(missingResponse.status).toBe(404);
expect(methodResponse.status).toBe(405);
```

- [ ] **Step 2: Verify the test fails**

Run: `bun test packages/server/tests/chat-session-status-routes.test.ts --filter "returns chat session status"`

Expected: FAIL because `/api/chat/sessions/:id/status` returns 405 or 404 before implementation.

### Task 2: Status Resolver

**Files:**
- Modify: `packages/server/src/chat/types/chat.types.ts`
- Modify: `packages/server/src/chat/chat-repository.ts`
- Modify: `packages/server/src/chat/chat-service.ts`
- Modify: `packages/server/src/chat/chat-workflow-idle.ts`

- [ ] **Step 1: Add contract types**

Add `ChatSessionRuntimeStatus = "running" | "idle" | "archived"` and `ChatSessionStatusRecord` with `sessionId`, nullable `taskId`, and `status`.

- [ ] **Step 2: Add repository read**

Add `getLatestTaskExecutionStatus(taskId: string): Promise<string | null>` to `ChatRepository`, implemented with `taskExecutionLogsTable` ordered by latest `startedAt`.

- [ ] **Step 3: Add service method**

Add `getSessionStatus(sessionId)` to `ChatService`. It returns null for a missing session, `archived` for archived rows, `running` when the latest linked task execution status is `running`, and `idle` otherwise.

- [ ] **Step 4: Reuse the repository read in idle helper**

Change `waitForTaskWorkflowIdle` to call the shared latest-status helper so the endpoint and existing wait loop use the same definition of running.

- [ ] **Step 5: Verify the route test passes**

Run: `bun test packages/server/tests/chat-session-status-routes.test.ts --filter "returns chat session status"`

Expected: PASS.

### Task 3: HTTP Route And OpenAPI

**Files:**
- Modify: `packages/server/src/http/chat-routes.ts`
- Modify: `packages/server/tests/openapi-contract.test.ts`
- Modify: `openapi.yaml`

- [ ] **Step 1: Add status route matching**

Add a status path matcher before the generic session matcher:

```typescript
const SESSION_STATUS_PATH = /^\/api\/chat\/sessions\/([^/]+)\/status\/?$/;
```

`GET` returns `jsonSuccess(status)`, missing sessions return `notFound("Chat session not found")`, and non-GET returns `methodNotAllowed()`.

- [ ] **Step 2: Document the route**

Add `GET /api/chat/sessions/{id}/status` to `openapi.yaml` and to `IMPLEMENTED_ROUTES`.

- [ ] **Step 3: Run focused checks**

Run:

```bash
bun test packages/server/tests/chat-session-status-routes.test.ts packages/server/tests/openapi-contract.test.ts
```

Expected: PASS.

### Task 4: Package Verification

**Files:**
- No edits unless verification finds a scoped issue.

- [ ] **Step 1: Run server checks**

Run:

```bash
bun run --filter devos-server check
bun run --filter devos-server typecheck
bun run --filter devos-server test
```

Expected: all three commands exit 0.
