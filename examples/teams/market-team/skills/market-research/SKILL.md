---
name: market-research
description: Coordinate a professional market research team into one sourced regime brief with scenarios, triggers, and invalidation.
---

# Market Research

Coordinate market research through explicit scope approval, verified specialist handoffs, and a final independent risk challenge.

## 1. Clarify

Ask one material question at a time until these fields are clear:

- Geography
- Asset scope
- Decision horizon
- Research question
- As-of expectation
- Available browsing and source access
- Output format
- Success criteria

Do not guess a missing constraint that would materially change the research route.

## 2. Approve

Present a compact brief containing scope, non-goals, source policy, proposed members, verification, and known limitations. Wait for explicit human approval before preparing any specialist handoff.

## 3. Route

Select only the roles needed for the approved question:

- `catalog:macro-analysis` for growth, inflation, policy, liquidity, and the event calendar.
- `catalog:rates-analysis` for the yield curve, real and nominal rates, credit, and market transmission.
- `catalog:market-structure` for breadth, volatility, concentration, positioning proxies, and technical confirmation.
- `catalog:sector-analysis` for leadership, rotation, relative strength, and earnings or policy sensitivity.
- `catalog:risk-analysis` for contradictory evidence, missing sources, failure modes, triggers, invalidation, and a verification verdict.

List every skipped member with the evidence for skipping it and a re-entry condition.

## 4. Prepare handoffs

Automatic role launch is disabled. Do not call a dispatch command or any other agent-launch API.

For every selected specialist, prepare a handoff containing the matching role skill, approved research question, source policy, expected artifact, known limitations, and verification bar. Label every handoff `Prepared, not executed`.

Each specialist step in the team manifest represents this manual handoff cycle;
it does not mean the coordinator executed the specialist. Stop after presenting
the handoffs. Continue only when the user supplies completed specialist outputs
in a later interaction. A prepared handoff is not evidence that a specialist ran.

## 5. Combine

Combine only completed macro, rates, market-structure, and sector outputs that
the user supplies, keeping primary evidence and inference separate. Prepare a
`catalog:risk-analysis` handoff against the combined draft and source list,
label it `Prepared, not executed`, and stop again. Return the final brief only
after the user supplies the completed risk review.

Return:

- Market regime
- Primary evidence
- Inference
- Scenario probabilities
- Triggers
- Invalidation
- Missing evidence
- Limitations
- As-of statement

Never invent blocked data. Never issue personalized buy, sell, entry, or position-size instructions.

## Source policy

Use browsing or search tools already available in the host agent. Do not require an API key. Prefer central-bank, treasury, statistics-agency, exchange, and index-provider sources before secondary reporting. Include source links and an as-of statement when the host supports them.
