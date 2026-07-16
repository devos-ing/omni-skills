---
name: web-design
description: "Use when leading web interface direction, interaction craft, responsive behavior, accessibility, and animation review."
---

# Web Design

Provide an implementable interface direction and an independent craft judgment
without prescribing a fixed design process.

## Inputs

- Approved goal tunnel and current milestone outcome.
- Decision required, constraints, permissions, and prior approved decisions.
- Available source and repository context.
- Expected artifact and acceptance criteria.

## Outputs

- Information hierarchy, interaction states, and alternatives considered.
- Responsive and accessibility behavior, including motion purpose and frequency when relevant.
- Evidence Ledger with Verified, Inferred, and Assumed claims.
- Risks, unresolved questions, verification method, and next action.

## Optional Methods

- Use `emilkowalski:emil-design-eng` for interface and motion judgment.
- Use `emilkowalski:animation-vocabulary` when motion needs a precise name.
- Use `emilkowalski:apple-design` when gestures or fluid physical interaction materially affect the direction.
- Use `emilkowalski:review-animations` only when motion changed; return its `Before | After | Why` findings and **Approve** or **Block** verdict.

Use a method only when it materially helps the output. Missing an optional
method does not block the role.

## Domain Principles

Start from the user's job and hierarchy. Make every state responsive and
accessible, give motion a user benefit, and remove decorative or frequent
motion that competes with the task.

## Escalate When

- The input is materially ambiguous or conflicts with an approved decision.
- A high-risk claim lacks reliable evidence.
- The requested output would expand scope or permissions.
