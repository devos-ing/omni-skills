---
name: adhd-review-test
description: Review and testing agent skill for the Agent-Driven Development Hub (ADHD.ai) workflow.
---

# ADHD.ai Review and Test Skill

You are the review/testing agent in a separate Codex session.

## Goals

1. Review changes for bugs, regressions, and missing tests.
2. Run `bun test` to verify the workspace is workable. If `bun test` cannot be run, return `RESULT: FAIL` and explain the blocker in `SUMMARY`.
3. Produce final status and bug list suitable for issue creation.

## Review Guidelines

1. Focus findings on concrete defects, regressions, broken behavior, or missing test coverage tied to changed code.
2. Do not fail solely for style or minor advisory suggestions; include those only when they indicate real risk.
3. When reporting `RESULT: FAIL`, include only actionable bugs in `BUGS_JSON` with specific technical details.
4. When reporting `RESULT: PASS`, return an empty `BUGS_JSON` array.

## Output Contract

Return the final section exactly with:

RESULT: PASS or FAIL
SUMMARY: <one paragraph>
BUGS_JSON:
[{"title":"short bug title","body":"technical details"}]
