# Session Activity Bubbles Design

## Scope

Show session-local assistant activity bubbles in the chat transcript while an agent
is working. The bubbles should make reading, writing, coding, browsing, docs, and
MCP/plugin activity feel like normal chat progress instead of hiding everything in
the mission panel's phase output.

## Goals

- Show lightweight loading bubbles for the selected session only.
- Classify live activity into user-facing states:
  - reading files
  - reading skills
  - reading docs
  - browsing websites
  - writing changes
  - coding
  - running MCP/tool activity, including the plugin or connector name when known
- Keep the mission progress panel as the detailed log and checkpoint surface.
- Avoid React render tests; cover behavior with pure mapper/state tests.

## Non-Goals

- Do not replace mission progress, checkpoints, or raw phase logs.
- Do not invent a new server contract for the first implementation.
- Do not show activity from other sessions in the active transcript.

## Architecture

Use the existing task activity, live stream, and realtime invalidation path as the
source of truth. Add a web-side mapper that reads workflow progress/log records
and produces transcript activity items. The mapper should be pure so it can be
covered by package-local tests without rendering components.

The chat transcript will render these items as assistant-side loading bubbles near
the latest working state. Final assistant messages remain regular chat messages.
The mission panel continues to render detailed output and checkpoints.

## Activity Classification

Classification should prefer structured event fields where available, then fall
back to conservative text matching on current stream/log content.

- File reads: file-read commands or log text that clearly indicates reading files.
- Skill reads: skill invocation paths, skill names, or skill-related command logs.
- Docs reads: documentation lookup or docs-fetch style activity.
- Website reads: browser/web/search/fetch activity.
- Writing: file write, patch, save, or edit activity.
- Coding: implementation/build/code generation activity that is not more specific.
- MCP/tool activity: tool or MCP names from structured events when available; if
  the tool name contains a plugin prefix, display that plugin name.

Unknown events should not create noisy bubbles.

## UI Behavior

Activity bubbles are ephemeral loading indicators, visually aligned with assistant
messages but lighter than durable assistant content. They should use concise labels
such as `Reading files...`, `Writing changes...`, and `Running MCP: GitHub...`.
Multiple raw events in the same category should collapse to the latest category so
the transcript stays conversational rather than becoming a log stream.

## Data Flow

1. `ChatRoomPanel` already scopes live stream lines and mission progress to the
   selected session.
2. A new pure helper derives activity bubble models from the selected session's
   `streamLines` and `missionProgress`.
3. `ChatTranscript` receives or derives those bubble models and renders them after
   durable messages and before raw standalone stream output.
4. Mission progress and existing log summaries remain unchanged except for shared
   helper reuse if useful.

## Testing

- Add focused Bun tests for the pure activity mapper.
- Cover session-scoped inputs, category collapse, MCP/plugin labels, and unknown
  event suppression.
- Run package web typecheck/build for visible UI changes.
- Use browser verification for the chat transcript after implementation.

## Risks

- Existing stream payloads may not always contain structured tool names, so MCP
  labels may initially depend on conservative parsing.
- Over-classifying logs could make the chat feel noisy; the mapper should prefer
  omission when uncertain.
- Realtime task activity is currently invalidated rather than merged directly, so
  the UI may trail by the task activity polling/invalidation cadence.
