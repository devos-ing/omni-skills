# PIV Brainstorm Phase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required `brainstorm` workflow phase before planning, with chatroom clarification questions and answers routed through the existing chat session.

**Architecture:** The built-in workflow becomes `brainstorm -> plan -> implement -> testing`. The brainstorm phase is a local workflow role/stage, not an `/api/agents` row, and it uses workflow-data chat actions keyed by `taskId` to publish questions and collect chatroom answers. The web UI keeps using the existing clarification composer for option selection, recommended badges, and custom answers.

**Tech Stack:** TypeScript, Bun, CLI workflow package, agent-adapters, server workflow-data/chat services, Next.js web clarification utilities, local PIV skills.

---

## File Structure

- Create `packages/cli/src/features/workflow/brainstorm/brainstorm.ts`: run the brainstorm phase, parse READY/NEEDS_INFO, persist `brainstormSummary`, and pause/resume through chat clarification.
- Create `packages/cli/src/features/workflow/brainstorm/brainstorm-parser.ts`: parse `BRAINSTORM_RESULT` and `QUESTIONS_JSON`.
- Create `packages/cli/src/features/workflow/brainstorm/types/brainstorm.types.ts`: keep brainstorm decisions, questions, and task-client contracts out of runtime files.
- Create `packages/cli/src/features/workflow/brainstorm/index.ts`: export concrete brainstorm runtime symbols used by the phase runner.
- Create `skills/piv-brainstorm/SKILL.md`: local PIV brainstorming skill adapted from the Superpowers brainstorming process.
- Modify CLI workflow type files under `packages/cli/src/features/workflow/types/`: add `brainstorm` phase, role, and stage contracts.
- Modify `packages/cli/src/features/workflow/pipeline/built-in-workflow-metadata.ts`: insert the required brainstorm assignment before planner.
- Modify `packages/cli/src/features/workflow/pipeline/built-in-workflow-phase-runner.ts`: dispatch the new phase handler.
- Modify `packages/cli/src/features/workflow/mission/issue-run-state-resolver.ts`: bootstrap new normal runs at local stage `brainstorm`.
- Modify `packages/cli/src/features/workflow/state.ts`: normalize and persist the new stage and `brainstormSummary`.
- Modify `packages/cli/src/skills/prompts.ts` and `packages/cli/src/skills/types/prompt.types.ts`: build brainstorm prompts and pass brainstorm context into planning.
- Modify `packages/cli/src/features/config/env.ts` and config types: add `skills.brainstorm` default and override support.
- Modify `packages/agent-adapters/src/types/agent-adapter.types.ts`, `packages/agent-adapters/src/validation.ts`, and `packages/agent-adapters/src/codex/cli/sessions/stage-config.ts`: allow adapter role `brainstorm`.
- Modify workflow-data protocol/server files to add `chat.publishClarification` and `chat.listClarificationAnswers`.
- Modify server chat repository/service files to find a session by task id, publish pending brainstorm questions, and treat chatroom answers as workflow clarification replies when `pendingRequest` is absent.
- Add or update focused tests in `packages/cli/tests`, `packages/server/tests`, and existing web utility tests without touching unrelated dirty web chatroom files.

## Task 1: Workflow Contracts And Config Defaults

**Files:**
- Modify: `packages/cli/src/features/workflow/types/workflow-metadata.types.ts`
- Modify: `packages/cli/src/features/workflow/types/workflow-agent.types.ts`
- Modify: `packages/cli/src/features/workflow/types/workflow-state.types.ts`
- Modify: `packages/cli/src/features/workflow/state.ts`
- Modify: `packages/cli/src/features/config/types/runtime.types.ts`
- Modify: `packages/cli/src/features/config/env.ts`
- Modify: `packages/agent-adapters/src/types/agent-adapter.types.ts`
- Modify: `packages/agent-adapters/src/validation.ts`
- Modify: `packages/agent-adapters/src/codex/cli/sessions/stage-config.ts`
- Test: `packages/cli/tests/config.test.ts`
- Test: `packages/cli/tests/workflow-managers.test.ts`

- [ ] **Step 1: Write the failing metadata and config tests**

Add assertions that built-in phases start with `brainstorm` and the resolved default skill is `piv-brainstorm/SKILL.md`:

```typescript
expect(metadata.phases.map((phase) => phase.id)).toEqual([
	"brainstorm",
	"plan",
	"implement",
	"testing",
]);

expect(config.skills.brainstorm).toBe(
	path.join(workspacePath, "skills", "piv-brainstorm", "SKILL.md"),
);
```

- [ ] **Step 2: Run RED tests**

Run: `bun test packages/cli/tests/config.test.ts packages/cli/tests/workflow-managers.test.ts`

Expected: FAIL because `skills.brainstorm` and phase id `brainstorm` do not exist.

- [ ] **Step 3: Add the minimal contracts**

Use these contract shapes:

```typescript
export type BuiltInWorkflowPhaseId =
	| "brainstorm"
	| "plan"
	| "implement"
	| "testing";

export type WorkflowAgentRole =
	| "brainstorm"
	| "planning"
	| "implementing"
	| "review-testing"
	| "github-comment";

export type WorkflowStage =
	| "backlog"
	| "brainstorm"
	| "plan"
	| "in_progress"
	| "in_review"
	| "canceled"
	| "done"
	| "failed";
```

Add `brainstorm: string` to `ProjectRuntimeConfig["skills"]`, set its default with `path.join("piv-brainstorm", "SKILL.md")`, add adapter role `"brainstorm"`, and map it to the planning stage config.

- [ ] **Step 4: Run GREEN tests**

Run: `bun test packages/cli/tests/config.test.ts packages/cli/tests/workflow-managers.test.ts`

Expected: PASS.

## Task 2: Brainstorm Skill, Prompt, And Parser

**Files:**
- Create: `skills/piv-brainstorm/SKILL.md`
- Create: `packages/cli/src/features/workflow/brainstorm/types/brainstorm.types.ts`
- Create: `packages/cli/src/features/workflow/brainstorm/brainstorm-parser.ts`
- Create: `packages/cli/src/features/workflow/brainstorm/index.ts`
- Modify: `packages/cli/src/skills/prompts.ts`
- Modify: `packages/cli/src/skills/types/prompt.types.ts`
- Test: `packages/cli/tests/workflow.test.ts` or new `packages/cli/tests/brainstorm.test.ts`

- [ ] **Step 1: Write failing parser and prompt tests**

Cover READY and NEEDS_INFO:

```typescript
expect(parseBrainstormDecision("BRAINSTORM_RESULT: READY\nSUMMARY: Build the smallest PIV task.")).toEqual({
	result: "ready",
	summary: "Build the smallest PIV task.",
});

expect(
	parseBrainstormDecision(
		[
			"BRAINSTORM_RESULT: NEEDS_INFO",
			'QUESTIONS_JSON: [{"question":"Which path?","options":[{"label":"A","value":"a","recommended":true}]}]',
		].join("\n"),
	),
).toEqual({
	result: "needs_info",
	questions: [
		{
			question: "Which path?",
			options: [{ label: "A", value: "a", recommended: true }],
		},
	],
});
```

Cover prompt generation:

```typescript
const prompt = await buildBrainstormPrompt(skillPath, issue, {
	answers: [{ question: "Which path?", answer: "Option A" }],
});
expect(prompt).toContain("You are the brainstorming agent");
expect(prompt).toContain("Workflow task: PIV-1");
expect(prompt).toContain("Previous brainstorm clarification answers:");
```

- [ ] **Step 2: Run RED tests**

Run: `bun test packages/cli/tests/brainstorm.test.ts`

Expected: FAIL because parser, prompt builder, and skill do not exist.

- [ ] **Step 3: Add parser, types, skill, and prompt builder**

Use these public types:

```typescript
export interface BrainstormOption {
	label?: string;
	recommended?: boolean;
	value: string;
}

export interface BrainstormQuestion {
	options?: BrainstormOption[];
	question: string;
}

export type BrainstormDecision =
	| { result: "ready"; summary: string }
	| { questions: BrainstormQuestion[]; result: "needs_info" };
```

Add `buildBrainstormPrompt(skillPath, issue, options)` that loads the skill, includes issue title/description/url, includes prior answers when present, and requires exactly `BRAINSTORM_RESULT: READY` or `BRAINSTORM_RESULT: NEEDS_INFO`.

- [ ] **Step 4: Run GREEN tests**

Run: `bun test packages/cli/tests/brainstorm.test.ts`

Expected: PASS.

## Task 3: Built-In Brainstorm Phase READY Path

**Files:**
- Create: `packages/cli/src/features/workflow/brainstorm/brainstorm.ts`
- Modify: `packages/cli/src/features/workflow/pipeline/built-in-workflow-metadata.ts`
- Modify: `packages/cli/src/features/workflow/pipeline/built-in-workflow-phase-runner.ts`
- Modify: `packages/cli/src/features/workflow/mission/issue-run-state-resolver.ts`
- Modify: `packages/cli/src/features/workflow/types/workflow-state.types.ts`
- Test: `packages/cli/tests/brainstorm.test.ts`

- [ ] **Step 1: Write the failing READY phase test**

The test should create a run state at `brainstorm`, return a final message with `BRAINSTORM_RESULT: READY`, and assert:

```typescript
expect(state.brainstormSummary).toContain("Smallest coherent scope");
expect(state.stage).toBe("plan");
expect(runAgent).toHaveBeenCalledWith(
	expect.objectContaining({
		role: "brainstorm",
		skills: [{ name: "brainstorm", path: config.skills.brainstorm }],
	}),
);
```

- [ ] **Step 2: Run RED test**

Run: `bun test packages/cli/tests/brainstorm.test.ts`

Expected: FAIL because `handleBrainstormStage` is missing.

- [ ] **Step 3: Implement the READY path**

`handleBrainstormStage` should:

```typescript
const answers = await taskClient.listChatClarificationAnswers(state.issue.id);
const prompt = await buildBrainstormPrompt(config.skills.brainstorm, state.issue, {
	answers,
});
const result = await deps.runAgentWithChatLog({
	workspacePath: config.workspacePath,
	projectId: config.id,
	issue: state.issue,
	agentRole: "brainstorm",
	skillPath: config.skills.brainstorm,
	prompt,
	invoke: ({ onStream } = { onStream: () => {} }) =>
		runAdapterAgent(agent, {
			role: "brainstorm",
			prompt,
			sessionId: state.codexSessionId,
			skills: [{ name: "brainstorm", path: config.skills.brainstorm }],
			onStream,
		}),
});
const parsed = parseBrainstormDecision(result.finalMessage || result.stdout);
if (parsed.result === "ready") {
	state.brainstormSummary = parsed.summary;
	await deps.transitionStage(state, "plan", taskClient);
}
```

Add the handler to `BuiltInWorkflowPhaseRunner` and bootstrap new normal run states at `brainstorm`.

- [ ] **Step 4: Run GREEN test**

Run: `bun test packages/cli/tests/brainstorm.test.ts`

Expected: PASS.

## Task 4: Brainstorm NEEDS_INFO Chat Publishing

**Files:**
- Modify: `packages/cli/src/features/workflow/brainstorm/brainstorm.ts`
- Modify: `packages/cli/src/features/workflow/types/workflow.types.ts`
- Modify: `packages/cli/src/features/workflow/workflow-data-client.ts`
- Modify: `packages/cli/src/features/workflow/workflow-data-protocol.ts`
- Modify: `packages/server/src/workflow-data/types/workflow-data.types.ts`
- Modify: `packages/server/src/workflow-data/workflow-data-service.ts`
- Modify: `packages/server/src/workflow-data/workflow-data-actions.ts`
- Modify: `packages/server/src/chat/chat-repository.ts`
- Test: `packages/cli/tests/brainstorm.test.ts`
- Test: `packages/server/tests/workflow-data-service.test.ts` or nearest workflow-data test

- [ ] **Step 1: Write failing NEEDS_INFO tests**

CLI assertion:

```typescript
expect(taskClient.publishChatClarification).toHaveBeenCalledWith(state.issue.id, [
	{
		question: "Which workflow boundary should own this?",
		options: [{ value: "workflow phase", recommended: true }],
	},
]);
expect(state.stage).toBe("brainstorm");
```

Server workflow-data assertion:

```typescript
const result = await service.handle({
	action: "chat.publishClarification",
	payload: { taskId, questions },
});
expect(result.ok).toBe(true);
expect(session.pendingQuestions?.[0]?.options?.[0]?.recommended).toBe(true);
```

- [ ] **Step 2: Run RED tests**

Run: `bun test packages/cli/tests/brainstorm.test.ts packages/server/tests/workflow-data-service.test.ts`

Expected: FAIL because chat workflow-data actions and task-client methods do not exist.

- [ ] **Step 3: Add workflow-data chat actions**

Add task-client methods:

```typescript
publishChatClarification(
	taskId: string,
	questions: BrainstormQuestion[],
): Promise<void>;
listChatClarificationAnswers(taskId: string): Promise<ChatSendAnswer[]>;
```

Add workflow-data actions:

```typescript
type WorkflowDataAction =
	| ExistingWorkflowDataAction
	| "chat.publishClarification"
	| "chat.listClarificationAnswers";
```

Server `chat.publishClarification` finds the active chat session by `taskId`, appends an assistant `clarification` message, sets `pendingRequest: null`, sets `pendingQuestions`, and updates the task status to `backlog` so normal work pickup pauses. `chat.listClarificationAnswers` returns answer metadata collected from that task-linked chat session.

- [ ] **Step 4: Update brainstorm NEEDS_INFO handling**

On NEEDS_INFO:

```typescript
state.brainstormNeedsInfoQuestions = parsed.questions;
await taskClient.publishChatClarification(state.issue.id, parsed.questions);
await deps.saveRunState(state);
```

Do not transition to `plan` until a later READY result.

- [ ] **Step 5: Run GREEN tests**

Run: `bun test packages/cli/tests/brainstorm.test.ts packages/server/tests/workflow-data-service.test.ts`

Expected: PASS.

## Task 5: Chatroom Answer Resume Path

**Files:**
- Modify: `packages/server/src/chat/types/chat.types.ts`
- Modify: `packages/server/src/chat/chat-send-service.ts`
- Modify: `packages/server/src/chat/chat-answer-metadata.ts`
- Modify: `packages/server/src/http/chat-route-schemas.ts`
- Test: `packages/server/tests/chat-clarification-routes.test.ts`
- Test: `packages/server/tests/chat-send-service.test.ts`

- [ ] **Step 1: Write failing chat answer tests**

Add a test where a chat session has `pendingQuestions` and `pendingRequest: null`, then the user submits:

```typescript
{
	content: "Use workflow phase",
	answers: [
		{
			question: "Which workflow boundary should own this?",
			answer: "workflow phase",
		},
	],
}
```

Assert:

```typescript
expect(resolveTaskRequirement).not.toHaveBeenCalled();
expect(updateIssue).toHaveBeenCalledWith(taskId, expect.objectContaining({ status: "plan" }));
expect(result.session.pendingQuestions).toBeNull();
expect(result.messages.at(-1)?.role).toBe("assistant");
```

- [ ] **Step 2: Run RED tests**

Run: `bun test packages/server/tests/chat-clarification-routes.test.ts packages/server/tests/chat-send-service.test.ts`

Expected: FAIL because current answer handling always routes to task intake.

- [ ] **Step 3: Implement workflow clarification answer handling**

Carry accepted answers through `AcceptedChatSend`:

```typescript
interface AcceptedChatSend {
	answers: ChatSendAnswer[];
	issue: BoardTaskApiRecord;
	requestText: string;
	session: ChatSessionRow;
	userRecord: ChatMessageRecord;
}
```

Before calling `resolveTaskRequirement`, branch when `session.pendingQuestions` exists, `session.pendingRequest` is `null`, and `answers.length > 0`. Clear pending questions, update the board task back to `plan`, append an assistant acknowledgement, and return without task-intake parsing.

- [ ] **Step 4: Run GREEN tests**

Run: `bun test packages/server/tests/chat-clarification-routes.test.ts packages/server/tests/chat-send-service.test.ts`

Expected: PASS.

## Task 6: Planning Consumes Brainstorm Summary

**Files:**
- Modify: `packages/cli/src/features/workflow/planning/plan.ts`
- Modify: `packages/cli/src/skills/prompts.ts`
- Modify: `packages/cli/src/skills/types/prompt.types.ts`
- Test: `packages/cli/tests/workflow.test.ts` or `packages/cli/tests/brainstorm.test.ts`

- [ ] **Step 1: Write failing planning prompt test**

Assert that a state with `brainstormSummary` passes a planner prompt section:

```typescript
const prompt = await buildPlanPrompt(skillPath, issue, {
	brainstormSummary: "Use the chatroom answer and keep this a workflow phase.",
});
expect(prompt).toContain("Brainstorm context:");
expect(prompt).toContain("Use the chatroom answer");
```

- [ ] **Step 2: Run RED test**

Run: `bun test packages/cli/tests/brainstorm.test.ts`

Expected: FAIL because plan prompt options do not include `brainstormSummary`.

- [ ] **Step 3: Add the prompt option**

Extend `PlanPromptOptions`:

```typescript
export interface PlanPromptOptions {
	autoSelectWarnings?: string[];
	brainstormSummary?: string;
	supplementalSkills?: SelectedSkill[];
}
```

Pass `state.brainstormSummary` from `handlePlanningStage` into `buildPlanPrompt`.

- [ ] **Step 4: Run GREEN test**

Run: `bun test packages/cli/tests/brainstorm.test.ts`

Expected: PASS.

## Task 7: Web Clarification Payload Verification

**Files:**
- Modify only if needed: `packages/web/tests/clarification-queue-utils.test.ts`
- Do not modify the currently dirty chat-room component files unless a failing test proves the UI cannot satisfy the requirement.

- [ ] **Step 1: Verify or add a pure utility test**

Confirm the existing utility sends selected options and custom answers back in order:

```typescript
expect(buildClarificationAnswers(questions, answers)).toEqual([
	{ question: "Which boundary?", answer: "workflow phase" },
	{ question: "Any constraint?", answer: "Use existing chatroom" },
]);
```

- [ ] **Step 2: Run the focused web test**

Run: `bun test packages/web/tests/clarification-queue-utils.test.ts`

Expected: PASS. If it already passes without edits, leave web source files untouched.

## Task 8: Package And Repo Verification

**Files:**
- No new source files unless a verification failure points to a scoped fix.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
bun test packages/cli/tests/brainstorm.test.ts
bun test packages/cli/tests/config.test.ts packages/cli/tests/workflow-managers.test.ts
bun test packages/server/tests/chat-clarification-routes.test.ts packages/server/tests/chat-send-service.test.ts
bun test packages/web/tests/clarification-queue-utils.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run required root gates**

Run:

```bash
bun run check
bun run typecheck
bun test
```

Expected: PASS, or report the exact blocker and whether it is caused by the scoped change or by pre-existing dirty work.

- [ ] **Step 3: Final status check**

Run: `git status --short --branch`

Expected: only scoped brainstorm-phase changes plus the pre-existing unrelated dirty web chatroom files.

## Self-Review

- Spec coverage: The tasks cover phase/role contracts, skill defaults, prompt loading, parser READY/NEEDS_INFO, stage transitions, chat publishing, answer resume, planner context, and web answer payload verification.
- Placeholder scan: No task contains TBD, TODO, or unspecified edge handling.
- Type consistency: `brainstorm`, `BrainstormQuestion`, `BrainstormDecision`, `publishChatClarification`, and `listChatClarificationAnswers` are named consistently across CLI, workflow-data, and server tasks.
