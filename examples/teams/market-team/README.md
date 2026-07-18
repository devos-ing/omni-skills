# Market Team

Market Team coordinates macro, rates, market-structure, sector, and risk specialists into one sourced market-regime brief.

## Preview from this repository

`market-team` is not published through `omniskill@latest` yet. From a clone of
this repository, install the checked-out team with the local development CLI:

```bash
bun run dev -- install examples/teams/market-team
```

Invoke the coordinator with a geography, asset scope, horizon, and research question:

```text
$market-research Assess whether U.S. equities are risk-on or fragile using macro, rates, breadth, and sector leadership.
```

Inspect and validate the checked-out dependency graph:

```bash
bun run dev -- deps examples/teams/market-team
bun run dev -- validate examples/teams/market-team
```

Automatic role launch is disabled. Each specialist stage means “prepare the
handoff, run it in a separate user-controlled task, and return the completed
output”; the coordinator does not execute the analysis itself. Every prepared
handoff is labeled `Prepared, not executed`.

After the macro, rates, structure, and sector outputs return, the coordinator
combines them into a draft and prepares a separate risk-analysis handoff. Return
the completed risk review before asking the coordinator for the final brief.

Market Team uses host-provided browsing and public sources. It requires no market-data API, marks blocked or stale evidence explicitly, and does not provide personalized investment advice.
