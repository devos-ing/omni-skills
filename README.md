# devos.ing

Talk is cheap, show me your agent system.

devos.ing is ADHD (Agentic Development Hub & Daemon): an all-in-one workflow for managing agentic development, reducing human involvement while keeping operators in control. It turns Linear issues into an agent-driven engineering workflow: plan -> implement -> review/test. It can run one issue at a time, poll for new work, or run scheduled automation sweeps across projects.

For non-technical operators, start with [docs/NON_TECHNICAL_GUIDE.md](docs/NON_TECHNICAL_GUIDE.md).

## Quick Start

1. Install dependencies.
2. Build the local CLI package.
3. Run guided setup.
4. Validate your setup.
5. Run one scoped workflow.

```bash
bun install
bun run build
npx devos help
npx devos setup
npx devos setup --check
npx devos run --project <PROJECT_ID>
```

Use `npx devos projects` to list available project IDs, then pass one of those values as `<PROJECT_ID>`.

## Common Commands

```bash
# install dependencies
bun install

# build and test the local CLI bin with npx
bun run build
npx devos help

# setup and validation
npx devos setup
npx devos setup --check

# local workspace startup/build shortcuts
bun run dev
bun run dev:server
bun run dev:web
devos daemon
bun run build:server
bun run build:web
bun run build

# inspect configured projects
bun run packages/cli/src/index.ts projects

# run one issue
bun run packages/cli/src/index.ts run --project <PROJECT_ID> --issue ENG-123

# local polling mode
bun run packages/cli/src/index.ts run --project <PROJECT_ID> --poll

# unattended scheduled mode (server-owned cron runner)
bun run --filter devos-server cron

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
bun run packages/cli/src/index.ts status --project <PROJECT_ID> --issue ENG-123

# skills management
bun run packages/cli/src/index.ts skills list [--project <PROJECT_ID>]
bun run packages/cli/src/index.ts skills add --title "<TITLE>" --description "<DESCRIPTION>" --content "<CONTENT>" [--project <PROJECT_ID>]
bun run packages/cli/src/index.ts skills update <NAME> [--title "<TITLE>"] [--description "<DESCRIPTION>"] [--content "<CONTENT>"] [--project <PROJECT_ID>]
bun run packages/cli/src/index.ts skills remove <NAME> [--project <PROJECT_ID>]
```

After `bun install` and `bun run build`, use `npx devos ...` from the repo root to test the local workspace CLI package.

## Local Server/Web Notes

Use `bun run dev` from the repository root to start the local API server and web UI together. The combined entrypoint runs `dev:server` with `PIV_SERVER_PORT=3001` and `dev:web` with `PORT=3002` so the two local servers do not contend for the same port.

Use `bun run dev:server` or `bun run dev:web` when you only need one side of the local stack.

Use `devos daemon` to run the production API server and web UI together in the foreground after production artifacts already exist. The command starts the server on `PIV_SERVER_PORT=3001` and the web UI on `PORT=3000` by default, with the web UI proxying to `DEVOS_SERVER_BASE_URL=http://127.0.0.1:3001`. Override those environment variables before starting when needed.

## Workflow Summary

1. Create or assign a Linear issue.
2. devos.ing plans the task.
3. devos.ing implements code changes and updates PR context.
4. devos.ing runs review/testing and loops on failures until `done` or `blocked`.
5. Review-only automations squash-merge completed PRs with `COMPLEXITY_SCORE < 5`; scores `>= 5` trigger a human approval email.

## Configuration Notes

- Primary config: `devos.config.ts`.
- Local overrides (gitignored): `devos.local.config.ts`.
- Guided setup stores local secrets in `.devos/config/env.sqlite` (and writes `.env` for compatibility).
- Docker-isolated Codex execution status and caveats (ROY-95): [docs/RELIABILITY.md#docker-isolated-codex-execution](docs/RELIABILITY.md#docker-isolated-codex-execution)

For full config shape, polling, automations/cron compatibility, env vars, and routing behavior, use:

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [docs/workspace-cli-commands.md](docs/workspace-cli-commands.md)
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
