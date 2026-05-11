# Agent-Driven Development Hub (ADHD.ai)

ADHD.ai turns Linear issues into an agent-driven engineering workflow: plan -> implement -> review/test. It can run one issue at a time, poll for new work, or run scheduled automation sweeps across projects.

For non-technical operators, start with [docs/NON_TECHNICAL_GUIDE.md](docs/NON_TECHNICAL_GUIDE.md).

## Quick Start

1. Install dependencies.
2. Run guided setup.
3. Validate your setup.
4. Run one scoped workflow.

```bash
bun install
bun run src/index.ts setup
bun run src/index.ts setup --check
bun run src/index.ts run --project <PROJECT_ID>
```

Use `bun run src/index.ts projects` to list available project IDs, then pass one of those values as `<PROJECT_ID>`.

## Common Commands

```bash
# setup and validation
bun run src/index.ts setup
bun run src/index.ts setup --check

# inspect configured projects
bun run src/index.ts projects

# run one issue
bun run src/index.ts run --project <PROJECT_ID> --issue ENG-123

# local polling mode
bun run src/index.ts run --project <PROJECT_ID> --poll

# unattended scheduled mode
bun run src/index.ts cron

# run the first enabled automation job once now
bun run cron:once

# run the hourly PR review job
bun run review:hourly

# run the hourly PR review job once now
bun run review:hourly:once

# create a release changeset
bun run changeset

# apply version updates, run quality gates, and publish
bun run publish:version

# push version commit and tags after publish
git push --follow-tags

# inspect run state for one issue
bun run src/index.ts status --project <PROJECT_ID> --issue ENG-123

# skills management
bun run src/index.ts skills list [--project <PROJECT_ID>]
bun run src/index.ts skills add --title "<TITLE>" --description "<DESCRIPTION>" --content "<CONTENT>" [--project <PROJECT_ID>]
bun run src/index.ts skills update <NAME> [--title "<TITLE>"] [--description "<DESCRIPTION>"] [--content "<CONTENT>"] [--project <PROJECT_ID>]
bun run src/index.ts skills remove <NAME> [--project <PROJECT_ID>]
```

After linking/installing the package bin, you can also use `adhd-ai ...` directly.

## Workflow Summary

1. Create or assign a Linear issue.
2. ADHD.ai plans the task.
3. ADHD.ai implements code changes and updates PR context.
4. ADHD.ai runs review/testing and loops on failures until `done` or `blocked`.
5. Review-only automations squash-merge completed PRs with `COMPLEXITY_SCORE < 5`; scores `>= 5` trigger a human approval email.

## Configuration Notes

- Primary config: `adhd-ai.config.ts`.
- Local overrides (gitignored): `adhd-ai.local.config.ts`.
- Legacy `piv-loop.config.ts` is still supported.
- Guided setup stores local secrets in `.piv-loop/config/env.sqlite` (and writes `.env` for compatibility).
- Docker-isolated Codex execution status and caveats (ROY-95): [docs/RELIABILITY.md#docker-isolated-codex-execution](docs/RELIABILITY.md#docker-isolated-codex-execution)

For full config shape, polling, automations/cron compatibility, env vars, and routing behavior, use:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/PLANS.md](docs/PLANS.md)
- [docs/RELIABILITY.md](docs/RELIABILITY.md)
- [docs/SECURITY.md](docs/SECURITY.md)

## Quality Checks

Run these before opening or updating a PR:

```bash
bun run check
bun run typecheck
bun test
```

## Star History

[![Star History Chart](https://api.star-history.com/svg?repos=1997roylee/show-me-ur-agents&type=Date)](https://star-history.com/#1997roylee/show-me-ur-agents&Date)
