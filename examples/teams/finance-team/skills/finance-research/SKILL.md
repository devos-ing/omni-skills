---
name: finance-research
description: Coordinate a professional public-company research team into one sourced, decision-ready, non-prescriptive brief.
---

# Finance Research

Coordinate public-company research through explicit scope approval, verified specialist handoffs, and a final independent risk challenge.

## 1. Clarify

Ask one material question at a time until these fields are clear:

- Company or ticker
- Decision horizon
- Decision question
- As-of expectation
- Available browsing and source access
- Output format
- Success criteria

Do not guess a missing constraint that would materially change the research route.

## 2. Approve

Present a compact brief containing scope, non-goals, source policy, proposed members, verification, and known limitations. Wait for explicit human approval before preparing any specialist handoff.

## 3. Route

Select only the roles needed for the approved question:

- `catalog:company-analysis` for business quality, competitive position, filings, management claims, and events.
- `catalog:financial-analysis` for revenue, margins, cash flow, balance-sheet quality, accounting signals, and trend consistency.
- `catalog:valuation-analysis` for base, bull, and bear scenarios, sensitivity, catalysts, and expectation risk.
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

Combine only completed company, financial, and valuation outputs that the user
supplies, keeping sourced facts, calculations, and inference separate. Prepare
a `catalog:risk-analysis` handoff against the combined draft and source list,
label it `Prepared, not executed`, and stop again. Return the final brief only
after the user supplies the completed risk review.

Return:

- Thesis
- Source-backed facts
- Inference
- Valuation scenarios
- Catalysts
- Risks
- Invalidation
- Missing evidence
- As-of statement

Never invent blocked data. Never issue personalized buy, sell, entry, or position-size instructions.

## Source policy

Use browsing or search tools already available in the host agent. Do not require an API key. Prefer regulator and issuer sources before secondary reporting. Include source links and an as-of statement when the host supports them.
