# Finance Team

Finance Team coordinates company, financial, valuation, and risk specialists into one sourced public-company research brief.

## Preview from this repository

`finance-team` is not published through `omniskill@latest` yet. From a clone of
this repository, install the checked-out team with the local development CLI:

```bash
bun run dev -- install examples/teams/finance-team
```

Invoke the coordinator with a company, horizon, and decision question:

```text
$finance-research Research NVDA as a 12-month watchlist candidate using public sources.
```

Inspect and validate the checked-out dependency graph:

```bash
bun run dev -- deps examples/teams/finance-team
bun run dev -- validate examples/teams/finance-team
```

Automatic role launch is disabled. Each specialist stage means “prepare the
handoff, run it in a separate user-controlled task, and return the completed
output”; the coordinator does not execute the analysis itself. Every prepared
handoff is labeled `Prepared, not executed`.

After the company, financial, and valuation outputs return, the coordinator
combines them into a draft and prepares a separate risk-analysis handoff. Return
the completed risk review before asking the coordinator for the final brief.

Finance Team uses host-provided browsing and public sources. It requires no market-data API, marks blocked or stale evidence explicitly, and does not provide personalized investment advice.
