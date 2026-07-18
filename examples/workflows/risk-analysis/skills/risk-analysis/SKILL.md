---
name: risk-analysis
description: Challenge a synthesized research draft for contradictory evidence, missing sources, failure modes, triggers, and invalidation.
---

# Risk Analysis

## Required input

- Synthesized draft
- Source list
- Assigned research question
- Decision horizon
- As-of expectation

## Required output

- Contradictions
- Missing evidence
- Failure modes
- Triggers
- Invalidation
- Verification verdict

## Process

1. Restate the assigned question, horizon, and as-of expectation.
2. List the available sources and classify each as primary or secondary.
3. Produce only the assigned analysis fields.
4. Separate sourced facts, calculations, and inference.
5. Mark blocked, stale, conflicting, or missing evidence explicitly.
6. Return a concise artifact to the parent coordinator; do not issue personalized trade advice.

## Source policy

Use browsing or search tools already available in the host agent. Do not require an API key. Prefer regulator, issuer, central-bank, treasury, statistics-agency, exchange, and index-provider sources before secondary reporting. Include an as-of statement and source links when the host supports them. Never invent a number to fill a source gap.
