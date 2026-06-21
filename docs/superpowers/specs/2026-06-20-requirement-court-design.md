# Requirement Court Design

## Goal

Change Goal Court so the default workflow focuses on agreeing to the user's requirement before any worker agent starts execution.

The runtime should behave like a requirement review court:

1. Clarify the user's raw request when it is vague.
2. Ask four role bots to discuss the requirement from different perspectives.
3. Show the human what each bot said.
4. Require at least three approvals from the four voting bots.
5. Ask a Judge bot to summarize the result and merge the discussion into one detailed requirement.
6. Ask the human owner to confirm the direction before execution can start.

## Non-Goals

- Do not make Codex, Claude, or GitHub Copilot execution the default behavior of `goal`.
- Do not add live provider SDK calls to the core runtime.
- Do not hide bot discussion behind a final pass/fail result.
- Do not require 100% test coverage; keep the existing 90% target.

## Roles

### Product Manager Bot

Identifier: `product_manager_bot`

Purpose: Review whether the requirement preserves the user's intended product value.

Expected discussion style:

```text
product_manager_bot: I think the requirement needs to name the admin user outcome and avoid expanding into unrelated import formats.
```

Approval focus:

- User value is clear.
- Product outcome is explicit.
- Scope does not grow beyond the user's request.

### Project Manager Bot

Identifier: `project_manager_bot`

Purpose: Review whether the requirement can be planned, sequenced, and tracked.

Expected discussion style:

```text
project_manager_bot: I think this should call out the import workflow, validation dependency, and completion evidence before the worker begins.
```

Approval focus:

- Delivery boundary is clear.
- Dependencies and sequencing are named.
- The task can become a manageable unit of work.

### Engineer Bot

Identifier: `engineer_bot`

Purpose: Review whether the requirement is technically feasible and bounded enough for an implementation agent.

Expected discussion style:

```text
engineer_bot: I think the requirement is feasible if it names the dashboard area, expected CSV shape, validation behavior, and files or modules in scope.
```

Approval focus:

- Technical boundary is clear.
- Important constraints are named.
- The worker will not need to invent large architecture decisions.

### Testing Bot

Identifier: `testing_bot`

Purpose: Review the requirement from a tester's perspective before implementation starts.

Expected discussion style:

```text
testing_bot: I think this needs acceptance criteria for valid rows, invalid rows, upload failure, and evidence from automated tests or a smoke run.
```

Approval focus:

- Acceptance criteria are observable.
- Edge cases are named.
- Required evidence can prove the work is complete.

### Requirement Judge Bot

Identifier: `requirement_judge_bot`

Purpose: Summarize the four role-bot discussions, tally the vote, and merge the result into one detailed requirement.

The Judge does not vote. It produces the user-facing result:

- discussion summary
- vote tally
- pass/fail verdict
- required changes if the court does not pass
- merged detailed requirement if the court passes

## Vote Rule

The voting panel has four voters:

- `product_manager_bot`
- `project_manager_bot`
- `engineer_bot`
- `testing_bot`

The requirement direction passes only when at least three of the four voters approve.

Rejected or amended votes still appear in the discussion transcript. Their required changes are carried into the Judge summary.

## Runtime Flow

```text
Human request
  -> CLI goal command
  -> brainstorm clarification gate
  -> draft initial requirement
  -> four role bots discuss and vote
  -> CLI prints bot discussion lines
  -> Judge tallies 3-of-4 approval rule
  -> Judge merges discussion into detailed requirement
  -> CLI prints detailed requirement
  -> human owner confirms direction
  -> worker execution remains gated
```

## CLI Behavior

`goal <request>` becomes requirement-first by default.

For a clear request, the CLI should print:

```text
Requirement discussion
product_manager_bot: ...
project_manager_bot: ...
engineer_bot: ...
testing_bot: ...

Judge summary
Approvals: 3/4
Verdict: approved

Detailed requirement
...
```

For an unclear request, the CLI should ask clarifying questions before the role bots discuss the requirement. The user can provide custom answers, keep questions open, or pause.

Worker streaming must not start automatically from `goal`. Execution can be added later as an explicit command or flag after the human confirms the requirement.

`stream-goal` can remain a compatibility alias, but its behavior should align with the requirement-first court unless a separate execution path is introduced.

## Manifest Changes

The default manifest should replace the old 3-bot goal direction panel with the new requirement court:

- add model configs for product manager, project manager, engineer, testing, and Judge roles
- add the five bots listed in this design
- set `decisionRule.voters` to `4`
- set `decisionRule.requiredApprovals` to `3`
- set `decisionRule.voterIds` to the four voting bot IDs
- keep `humanFinalApproval` as `true`
- update `workerExecutionGate.mayStartWhen` to require at least three approvals and human confirmation

The manifest loader should continue to upgrade older manifests that still use the previous model or bot IDs.

## Data Model

The runtime should expose a requirement discussion result with these fields:

- raw request
- clarified request
- draft requirement contract
- bot discussion entries
- bot votes
- vote verdict
- Judge summary
- merged detailed requirement
- human confirmation state

Each bot discussion entry should include:

- bot ID
- display name
- role
- message
- vote
- confidence
- required changes

## Error Handling

If fewer than three bots approve, the Judge result should be `not approved`, and the CLI should print the required changes instead of starting worker execution.

If a bot vote is duplicated or comes from an unknown bot ID, the existing vote validation should reject it.

If required details remain missing after clarification, the runtime should keep the goal paused and show the unresolved questions.

## Testing

Focused tests should cover:

- default manifest uses the five new court bots
- decision rule is 3 approvals from 4 voters
- vote tally approves 3-of-4 and rejects 2-of-4
- Judge is not counted as a voter
- CLI prints role-bot discussion lines
- `goal` does not stream to a worker by default
- unclear requests still ask clarification questions first
- legacy manifest loading remains supported

Coverage should stay at or above 90%.
