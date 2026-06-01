# Chat Session Status API Design

## Goal

Expose a server API endpoint that lets callers check whether a chat session is
running, idle, or archived.

## Endpoint

`GET /api/chat/sessions/{id}/status`

Successful response:

```json
{
  "sessionId": "session-1",
  "taskId": "task-1",
  "status": "running"
}
```

`taskId` is nullable because a session can exist without a linked task.

## Status Rules

- Return `archived` when `chat_sessions.archived` is true.
- Return `running` when the session has a linked task and the latest execution
  log for that task has `status` equal to `running`.
- Return `idle` when the session exists but does not have a latest running
  execution. This includes pending-for-agent sessions, sessions without
  execution logs, and sessions without a linked task.

## Architecture

The chat repository will own the session lookup and latest execution-log query.
The chat service will expose a small `getSessionStatus(sessionId)` method that
maps rows into the public response contract. The existing chat route module will
add the status path before the generic session route.

## Error Handling

- Missing session: `404` with `Chat session not found`.
- Non-GET status route method: `405`.
- The route performs no mutation and emits no realtime events.

## Tests

Add server route coverage for idle, running, archived, missing, and method-not
allowed behavior. Update the OpenAPI route contract so the endpoint is
documented with the same shape.
