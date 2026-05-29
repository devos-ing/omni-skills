---
name: piv-brainstorm
description: Clarify intent and scope for a PIV workflow task before planning
---

# PIV Brainstorm

Explore the user's request before planning. Keep the output concise and useful
for the next planning agent.

## Process

1. Identify the requested behavior and the workflow boundary that should own it.
2. Check for ambiguity in user intent, user-facing behavior, data flow, and
   verification.
3. If a necessary answer is missing, ask one to three concise questions.
4. When options are useful, include two or three options and mark exactly one
   best recommendation with `"recommended": true`.
5. When enough is known, return a compact summary for planning.

## Output Contract

Return exactly one route.

For ready tasks:

```text
BRAINSTORM_RESULT: READY
SUMMARY: <concise planning context>
```

For unclear tasks:

```text
BRAINSTORM_RESULT: NEEDS_INFO
QUESTIONS_JSON:
[{"question":"What should happen?","options":[{"label":"Recommended path","value":"recommended path","recommended":true}]}]
```
