# PIV Brainstorm Phase Design

## Scope

Add one required brainstorm workflow phase to the built-in PIV flow for chat-created tasks. The phase runs before planning and uses a local PIV brainstorming skill modeled after the Superpowers brainstorming workflow. It is a workflow role and phase, not a persistent `/api/agents` record.

## Goals

- Run exactly one brainstorm agent before the existing planning agent.
- Keep new chat session creation behavior intact: create the default chat task as today, then let the runner process it through the new first phase.
- Store brainstorm output in run state as `brainstormSummary` so later workflow stages can consume it without changing the public chat API contract.
- Keep the workflow project-agnostic and aligned with existing skill path configuration.

## Non-Goals

- Do not create or update rows in the `agents` table when a chat session is created.
- Do not add a new Agents-page management surface for brainstorm agents.
- Do not change the stable planning parser markers such as `PLANNING_RESULT`, `SUCCESS_GOAL`, or `QUESTIONS_JSON`.
- Do not add parallel brainstorm agents in this pass.

## Architecture

Extend the built-in workflow metadata from `Plan -> Implement -> Testing` to `Brainstorm -> Plan -> Implement -> Testing`. Add a new `brainstorm` workflow role, a `brainstorm` built-in phase id, a local `brainstorm` run-state stage, and a configurable brainstorm skill path. The default path is `piv-brainstorm/SKILL.md`.

The brainstorm phase uses the same adapter bridge and chat-log path conventions as other workflow roles. Its final message is recorded as `RunState.brainstormSummary`, then the runner transitions the local run state to `plan`. Planning includes a concise brainstorm context section when `brainstormSummary` exists. Planning remains responsible for returning the existing READY or NEEDS_INFO contract.

## Components

- Workflow types: add `brainstorm` to workflow role, agent chat-log role, local workflow stage, and built-in phase types.
- Workflow metadata: insert a required `brainstormer` assignment before `planner`.
- Skill configuration: add `skills.brainstorm` to env/config defaults and tests.
- Prompt building: add a brainstorm prompt that loads `piv-brainstorm/SKILL.md` and asks for a concise design/requirements artifact.
- Stage runner: add a brainstorm handler that runs the brainstorm agent, stores the result, and transitions to `plan`.
- Planning prompt: include `brainstormSummary` context when it exists.
- Skill pack: add `skills/piv-brainstorm/SKILL.md` with a compact PIV-specific version of the Superpowers brainstorming process.

## Data Flow

1. A user creates a new chat session.
2. The server creates the same default backlog chat task and session as it does today.
3. The workflow runner picks up the board task while its server status remains `plan`.
4. New local run state starts at `brainstorm` for normal runs.
5. The brainstorm agent reads the task title, description, chat context, repo constraints, and brainstorming skill.
6. The brainstorm output is persisted to `brainstormSummary` in workflow state.
7. The runner transitions the local stage to `plan`.
8. The planning phase receives the brainstorm context and returns the existing planning contract.
9. Implementation and review/testing continue unchanged.

## Error Handling

The brainstorm phase is required. If the brainstorm agent fails, the pipeline fails the task using the same required-agent failure path used by planning, implementation, and testing. If stored brainstorm context is missing or empty on a resumed run, the planning phase runs with no context section rather than crashing.

## Testing

- Add a CLI workflow metadata test proving the built-in phase order is `brainstorm`, `plan`, `implement`, `testing`.
- Add config tests proving `skills.brainstorm` defaults to `piv-brainstorm/SKILL.md` and can be overridden.
- Add prompt tests proving the brainstorm prompt loads the skill and includes task context.
- Add stage tests proving the brainstorm phase records output and transitions to `plan`.
- Keep existing chat route behavior covered by current session creation tests unless implementation changes the server contract.

## Risks

- The current runner bootstraps normal runs at `plan`, so implementation must explicitly bootstrap new normal runs at `brainstorm` while keeping server board status eligibility at `plan`.
- Brainstorm output can become noisy if it is too long. The prompt asks for concise design context for the planner, not a full implementation plan.
- Config and skill path changes touch several contract surfaces; tests cover defaults and prompt generation together.
