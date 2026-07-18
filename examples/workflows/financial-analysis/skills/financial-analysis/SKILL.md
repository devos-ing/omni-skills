---
name: financial-analysis
description: Analyze revenue, margins, cash flow, balance-sheet quality, accounting signals, and trend consistency from public-company evidence.
---

# Financial Analysis

## Required input

- Company or ticker
- Assigned research question
- Decision horizon
- As-of expectation
- Available filings

## Required output

- Revenue
- Margins
- Cash flow
- Balance sheet
- Accounting signals
- Trend consistency
- Limitations

## Process

1. Restate the assigned question, horizon, and as-of expectation.
2. List the available sources and classify each as primary or secondary.
3. Produce only the assigned analysis fields.
4. Separate sourced facts, calculations, and inference.
5. Mark blocked, stale, conflicting, or missing evidence explicitly.
6. Return a concise artifact to the parent coordinator; do not issue personalized trade advice.

## Source policy

Use browsing or search tools already available in the host agent. Do not require an API key. Prefer regulator, issuer, central-bank, treasury, statistics-agency, exchange, and index-provider sources before secondary reporting. Include an as-of statement and source links when the host supports them. Never invent a number to fill a source gap.
