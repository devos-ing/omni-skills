# devos.ing Non-Technical Guide

This guide explains how to use devos.ing as an operator without needing to read the codebase.

## What devos.ing Does

devos.ing takes work tracked in Linear and moves it through an automated engineering workflow:

1. planning
2. implementation
3. review and testing

The system keeps Linear and GitHub updated as work advances.

## Basic Workflow

1. A person creates or assigns a Linear issue.
2. devos.ing picks up eligible issues based on project routing config.
3. A planning agent writes a concrete implementation plan.
4. An implementation agent changes code in the target repository and updates the pull request context.
5. A review/testing agent validates the result.
6. If review/testing fails, devos.ing loops back to implementation with structured bug feedback.
7. The issue ends as `done` or `blocked`.

## How Each Integration Fits

### Linear

Linear is the work queue and progress tracker.

- Issues are the source of truth for what should be done.
- Status and comments are updated as stages change.
- Complex planning outputs can be split into child issues.

### GitHub

GitHub is where code changes are reviewed and tracked.

- devos.ing creates or updates branch/PR context during implementation.
- Review/testing feedback is tied back to the same work stream.
- PR history gives an audit trail of what changed.

### Resend (Optional)

Resend is used only for optional email notifications.

- devos.ing can send terminal outcome notifications (`done` or `blocked`).
- If Resend is not configured, the core workflow still works.

### Claude and OpenAI Codex

devos.ing runs agent stages using a configurable backend and model settings.

- Planning, implementation, and review/testing can use configured models.
- Claude/OpenAI Codex are runtime options, not both required at the same time.
- Behavior depends on your project config and environment values.

## Operator Setup and First Run

1. Run `npx devos onboard` and answer prompts.
2. Run `npx devos onboard --check` to validate config and required tooling.
3. Run `npx devos projects` to confirm project resolution.
4. Start one scoped run: `npx devos run --project <PROJECT_ID>`.
5. Confirm run state appears under `.devos/projects/<project-id>/runs`.

More detail:

- onboarding flow: [new-user-onboarding.md](product-specs/new-user-onboarding.md)
- operations and plan contract: [PLANS.md](PLANS.md)
- reliability behavior: [RELIABILITY.md](RELIABILITY.md)

## What To Check When Work Is Blocked

1. Confirm the issue is in the expected Linear status and assigned to the expected project.
2. Check run state and errors under `.devos/projects/<project-id>/`.
3. Verify required credentials exist in environment or local secret storage.
4. Confirm GitHub authentication and repository routing are valid.
5. Re-run with scoped flags (`--project`, `--issue`) to isolate one workflow path.
