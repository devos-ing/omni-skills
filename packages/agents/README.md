# devos-agents

`devos-agents` is the runtime-neutral OOP core for defining agents and
workflows in devos.ing. It describes concepts such as agents, tools,
guardrails, sessions, tracing, handoffs, and sandbox-backed agents without
knowing how Codex, Claude, Cursor, Linear, GitHub, or the CLI execute work.

Provider execution stays in `packages/agent-adapters`. CLI workflow policy,
task state, leases, worktrees, notifications, and integrations stay in
`packages/cli`.

## Quick Start

```ts
import { Agent, Workflow, run } from "devos-agents";

const assistant = new Agent({
	name: "Assistant",
	instructions: "You are a helpful assistant.",
	runner: {
		run: async ({ input }) => ({
			output: `Done: ${input}`,
			finalMessage: `Done: ${input}`,
		}),
	},
});

const result = await run(
	assistant,
	"Write a haiku about recursion in programming.",
);

const workflow = new Workflow({
	name: "Workflow A",
	description: "Code workflow",
	phases: [{ title: "Plan" }, { title: "Implement" }, { title: "Review" }],
	agents: [assistant],
});

await workflow.setPhase("Plan").callAgent("Assistant", "Create a plan.");
```

`phase` is the canonical workflow term. `phrases` and `setPhrase()` are kept as
small compatibility aliases for older examples and generated workflow scripts.

```ts
const workflow = new Workflow({
	name: "Compatibility Flow",
	phrases: [{ title: "Plan" }],
	agents: [assistant],
});

await workflow.setPhrase("Plan").callAgent("Assistant", "Create a plan.");
```

## Concepts

### Agents

An `Agent` is a named unit configured with instructions, optional model
metadata, tools, guardrails, handoffs, and a runner. The default runner echoes
the input as a string, which is useful for simple tests. Production execution
should provide a runner or use a package-specific bridge.

### Sandbox Agents

`SandboxAgent` extends `Agent` with a filesystem workspace and sandbox mode.
It describes where longer-running work can happen; it does not create
worktrees or enforce sandboxing itself.

### Tools

`FunctionTool`, `McpTool`, and `HostedTool` wrap callable capabilities behind a
consistent `invoke(input)` contract. Tool implementations are deliberately
small so provider-specific behavior can live outside this package.

### Guardrails

Guardrails validate inputs, outputs, or tool activity. `InputGuardrail`,
`OutputGuardrail`, and `ToolGuardrail` set the stage automatically, while
`BasicGuardrail` can represent any stage.

### Sessions

Sessions store conversation or run history per agent. `MemorySessionStore`
provides an in-memory implementation for tests and lightweight workflows.

### Tracing

Tracing records workflow and agent events. `MemoryTraceRecorder` keeps an
ordered in-memory event list for tests and local inspection.

### Handoffs

Handoffs describe possible delegation from one agent to another. They are
metadata in v1; routing policy belongs to the workflow or CLI layer.

### Realtime Agents

Realtime agents are a future boundary. This package currently documents the
concept but does not implement voice or realtime execution.

## Boundaries

- No CLI imports.
- No Linear, GitHub, or database imports.
- No provider adapter imports.
- No raw shell execution.
- Keep type contracts under `src/types/`.
