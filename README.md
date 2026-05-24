# devos.ing

Talk is cheap, show me your agent system.

devos.ing is ADHD (Agentic Development Hub & Daemon): an all-in-one workflow for managing agentic development, reducing human involvement while keeping operators in control. It turns Linear issues into an agent-driven engineering workflow: plan -> implement -> review/test. It can run one issue at a time, poll for new work, or run scheduled automation sweeps across projects.

For non-technical operators, start with [docs/NON_TECHNICAL_GUIDE.md](docs/NON_TECHNICAL_GUIDE.md).

## Quick Start

1. Install dependencies.
2. Build the local CLI package.
3. Run guided onboarding.
4. Validate your onboarding.
5. Start the local server, web UI, and workflow worker.
6. Run one scoped workflow.

```bash
bun install
bun run build
npx devos help
npx devos onboard
npx devos onboard --check
bun run dev
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

# onboarding and validation
npx devos onboard
npx devos onboard --check

# recommended local web UI stack: API 3001, web 3000, workflow worker
bun run dev

# if the web UI reports "No CLI worker connected to /api/workflow";
# this starts both the command worker and continuous polling
bun run dev:worker

# standalone command worker only, without polling
npx devos worker

# production/local package daemon after build artifacts exist
devos daemon

# local workspace single-service startup/build shortcuts
bun run dev:server
bun run dev:web
bun run build:server
bun run build:web
bun run build

# inspect configured projects
npx devos projects

# run one issue
npx devos run --project <PROJECT_ID> --issue ENG-123

# local polling mode
npx devos run --project <PROJECT_ID> --poll

# daemon-owned continuous workflow polling
npx devos run --all-projects --poll-forever

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
npx devos status --project <PROJECT_ID> --issue ENG-123

# skills management
npx devos skills list [--project <PROJECT_ID>]
npx devos skills add --title "<TITLE>" --description "<DESCRIPTION>" --content "<CONTENT>" [--project <PROJECT_ID>]
npx devos skills update <NAME> [--title "<TITLE>"] [--description "<DESCRIPTION>"] [--content "<CONTENT>"] [--project <PROJECT_ID>]
npx devos skills remove <NAME> [--project <PROJECT_ID>]
```

After `bun install` and `bun run build`, use `npx devos ...` from the repo root to test the local workspace CLI package.

## Local Server/Web Notes

Use `bun run dev` from the repository root to start the local API server, web UI,
and workflow worker together. The combined entrypoint runs `dev:server`,
`dev:web` with `PORT=3000`, and `dev:worker` connected to `/api/workflow`.

Use `bun run dev:server`, `bun run dev:web`, or `bun run dev:worker` when you
only need one side of the local stack. `bun run dev:worker` starts both the
outbound command worker for `/api/workflow` and continuous workflow polling with
`run --poll-forever`. Chat task creation and browser command streams need the
worker connected; if the web UI returns
`No CLI worker connected to /api/workflow`, keep the server running and start
the dev worker with:

```bash
bun run dev:worker
```

The worker connects to `ws://127.0.0.1:3001/api/workflow` by default. Override
that target when needed with:

```bash
DEVOS_SERVER_BASE_URL=http://127.0.0.1:3001
DEVOS_WORKFLOW_WS_URL=ws://127.0.0.1:3001/api/workflow
```

After `bun run build`, use `devos worker` or `npx devos worker` from the
repository root only when you want the standalone command worker without
polling. The older `workflow-worker` command remains available as a compatibility
alias.

Use `devos daemon` to run the production API server, web UI, outbound CLI workflow worker, and workflow poller together in the foreground after production artifacts already exist. The command starts the server on `PIV_SERVER_PORT=3001`, the web UI on `PORT=3000`, and a supervised `run --all-projects --poll-forever` worker by default, with command and database websocket traffic sharing `DEVOS_WORKFLOW_WS_URL` at `/api/workflow`. Override those environment variables before starting when needed.

Server cron remains a separate scheduled automation runner. Start it with `bun run --filter devos-server cron` when you want server-owned cron jobs, or use `bun run cron:once` to run the first enabled automation job once now.

To run the full local development stack in Docker, use:

```bash
docker compose up
```

The Compose stack starts the web UI at `http://localhost:3000`, the API server
health endpoint at `http://localhost:3001/health`, the workflow worker connected
to `ws://server:3001/api/workflow`, and the landing site at
`http://localhost:3002`. Stop it with:

```bash
docker compose down
```

## Configuration Notes

- Guided setup stores local secrets in `~/.devos/config/env.sqlite` (and writes `.env` for compatibility).
- Guided setup writes the local instance config to `~/.devos/config/instance.config.json`.
- Local instance data lives under `~/.devos/instances/default`.
- Docker-isolated Codex execution status and caveats (ROY-95): [docs/RELIABILITY.md#docker-isolated-codex-execution](docs/RELIABILITY.md#docker-isolated-codex-execution)

For runtime config resolution, polling, env vars, and routing behavior, use:

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
