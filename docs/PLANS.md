# Plans

Execution plans and plan artifacts are tracked under `docs/exec-plans/`.

## Workflow Plan Contract

Planning output should remain concise and implementation-focused, including:

1. scope summary
2. implementation steps
3. test plan
4. known risks

## Operating Commands

1. `bun run src/index.ts run --project default`
2. `bun run src/index.ts run --all-projects`
3. `bun run src/index.ts status --project default --issue ENG-123`
4. `bun run src/index.ts projects`

## Hourly Review Automation Example

Use an hourly review-only automation job to re-run PR review/testing in parallel across resumable runs and squash-merge completed PRs whose complexity score is below the human approval threshold:

```ts
export default {
  automations: {
    jobs: [
      {
        id: "hourly-pr-review",
        schedule: { frequency: "hourly", every: 1, minute: 0 },
        run: { reviewOnly: true, allProjects: true },
      },
    ],
  },
};
```

Run it manually with:

1. `bun run review:hourly`
2. `bun run review:hourly:once`

Per-issue leases still prevent duplicate workers from processing the same issue concurrently.

## Quality Commands

1. `bun run check`
2. `bun run typecheck`
3. `bun test`
