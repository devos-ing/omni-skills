---
name: rtk-command-discipline
description: "Use the repository command wrapper for shell commands."
---

# RTK Command Discipline

Use this skill when working in a repository that expects shell commands to run
through `rtk`.

Rules:

- Prefix shell commands with `rtk`.
- Prefer the repo's documented command wrappers.
- Use the exact verification command the repo asks for.

Examples:

```bash
rtk bun run check
rtk git status --short
rtk bun test tests/workflow-bundles.test.ts
```
