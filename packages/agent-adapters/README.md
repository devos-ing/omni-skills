# adapters

Standard runtime adapters for devos.ing agent backends.

This package owns the contract between the workflow engine and provider-specific
agent runtimes. The CLI passes a resolved project config into
`createAgentAdapter`, and each adapter normalizes provider output into the same
`AgentResult` shape.

## Public Contract

Every adapter implements:

```ts
import type { AgentAdapter, AgentResult } from "adapters";

export class ExampleAdapter implements AgentAdapter {
	async runTaskIntake(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	async runPlan(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	async resume(sessionId: string, prompt: string): Promise<AgentResult> {
		return this.resumeSession(sessionId, prompt);
	}

	async runReview(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	async runGithubComment(prompt: string): Promise<AgentResult> {
		return this.runNewSession(prompt);
	}

	private async runNewSession(prompt: string): Promise<AgentResult> {
		return {
			finalMessage: prompt,
			stdout: "",
		};
	}

	private async resumeSession(
		sessionId: string,
		prompt: string,
	): Promise<AgentResult> {
		return {
			sessionId,
			finalMessage: prompt,
			stdout: "",
		};
	}
}
```

## Adding An Adapter

1. Add the backend literal to `AgentBackend` in
   `src/agent-adapter.types.ts`.
2. Add provider-specific config fields to `AgentAdapterRuntimeConfig` only when
   they are needed by the runtime boundary.
3. Add the adapter class under a provider folder, such as
   `src/example/adapter.ts`, with provider helpers beside it.
4. Add `constants.ts`, `configuration-doc.ts`, and `index.ts` in that provider
   folder.
5. Register the provider definition in `src/registry.ts`.
6. Export provider subpaths from `package.json`, such as
   `adapters/example` and `adapters/example/output`.
7. Add focused tests for factory selection, command arguments, parsing, session
   IDs, usage, and error mapping.

## Shared Registry

CLI, server, and future UI code should use these shared exports instead of
duplicating backend/model lists:

```ts
import {
	agentConfigurationDoc,
	availableAgentModels,
	resolveAgentConfiguration,
} from "adapters";
```

`availableAgentModels` and `agentConfigurationDoc` are maintained catalogs for
defaults, docs, and UI hints. `resolveAgentConfiguration` accepts custom model
ids by default so newly released provider models can be used before this catalog
is updated.

## Rules

- Build commands as `{ command, args, cwd, env }` style data; do not assemble raw
  shell command strings.
- Keep provider parsers beside provider code.
- Keep provider-specific files grouped by folder, such as `src/codex/*` and
  `src/claude/*`.
- Return normalized `AgentResult` values with `finalMessage`, `stdout`,
  optional `sessionId`, and optional token usage.
- Keep workflow orchestration, Linear, GitHub, database, and run-state logic out
  of this package.
- Keep TypeScript contracts in `*.types.ts` modules and TypeScript files under
  250 lines.
