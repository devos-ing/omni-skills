# Orchestration Preflight Capabilities Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make orchestration preflight truthful about adapter evidence capability and generate Codex profiles only from models exposed by the installed Codex CLI identity.

**Architecture:** A subprocess-backed plugin normalizes `codex debug models` output into a small catalog, while the pure orchestration runtime selects tier defaults and validates custom configuration. Dispatch planning receives immutable adapter capability metadata, persists it in dry-run plans, and keeps actual launch evidence in attempts and receipts only. Installation migrates only the exact legacy generated config and leaves custom files untouched.

**Tech Stack:** Bun, TypeScript, Commander, Zod, Bun test, Codex CLI, Ponytrail snapshots.

---

## File Structure

- Create `src/plugins/codex-model-catalog.ts`: subprocess adapter, Zod parsing, normalized catalog, and typed discovery failures.
- Create `tests/codex-model-catalog.test.ts`: catalog parsing and command/malformed/empty failure coverage.
- Modify `src/runtimes/omniskill/orchestration.ts`: catalog capability type, dynamic default selection, and custom config compatibility validation.
- Modify `tests/orchestration.test.ts`: deterministic tier selection and compatibility error coverage.
- Modify `src/plugins/agent-profile-installer.ts`: create/update/unchanged config planning and atomic legacy migration.
- Modify `tests/agent-profile-installer.test.ts`: missing, legacy, custom, and rollback behavior.
- Modify `src/plugins/orchestration-dispatcher.ts`: immutable adapter and evidence capability metadata.
- Modify `src/runtimes/omniskill/orchestration-dispatch.ts`: capability input and `DispatchPlan` schema.
- Modify `src/plugins/orchestration-run-store.ts`: derive receipt adapter from the selected plan.
- Modify `tests/orchestration-dispatcher.test.ts`, `tests/orchestration-dispatch.test.ts`, and `tests/orchestration-run-store.test.ts`: capability and persistence coverage.
- Modify `src/omniskill.ts`: inject discovery during Codex orchestration installs and expose truthful dry-run output.
- Modify `src/cli.ts`: wire the real model-catalog provider through the existing subprocess seam.
- Modify `src/plugins/index.ts`: export the catalog plugin.
- Modify `tests/omniskill.test.ts` and `tests/cli.test.ts`: install injection, no-write dry run, and dispatch JSON behavior.
- Modify `examples/teams/startup-team/skills/startup-goal/SKILL.md`: distinguish preflight capability from receipt evidence.
- Modify `examples/teams/startup-team/workflow.lock.json`: refresh the local-skill fingerprint.
- Modify `tests/workflow-bundles.test.ts`: pin the coordinator wording contract.
- Modify `docs/architecture.md`: document discovery and evidence boundaries.

### Task 1: Add the Codex Model Catalog Plugin

**Files:**
- Create: `src/plugins/codex-model-catalog.ts`
- Create: `tests/codex-model-catalog.test.ts`
- Modify: `src/plugins/index.ts`

- [ ] **Step 1: Write the failing parser and command tests**

Create `tests/codex-model-catalog.test.ts` with a documented-shape fixture and assertions for normalization and typed failures:

```ts
import { describe, expect, test } from "bun:test";
import {
  CodexModelCatalogError,
  createCodexModelCatalogProvider,
} from "../src/plugins/codex-model-catalog";

const catalogJson = JSON.stringify({
  models: [
    {
      slug: "gpt-5.5",
      visibility: "list",
      priority: 0,
      supported_reasoning_levels: [
        { effort: "low", description: "Fast" },
        { effort: "medium", description: "Balanced" },
        { effort: "high", description: "Deep" },
      ],
    },
    {
      slug: "hidden-model",
      visibility: "hidden",
      priority: 1,
      supported_reasoning_levels: [{ effort: "high", description: "Deep" }],
    },
  ],
});

describe("Codex model catalog", () => {
  test("runs the documented command and normalizes only orchestration fields", async () => {
    const commands: unknown[] = [];
    const provider = createCodexModelCatalogProvider(async (command) => {
      commands.push(command);
      return { stdout: catalogJson, stderr: "", exitCode: 0 };
    });

    await expect(provider("/tmp/project")).resolves.toEqual([
      {
        slug: "gpt-5.5",
        visibility: "list",
        priority: 0,
        supportedReasoningEfforts: ["low", "medium", "high"],
      },
      {
        slug: "hidden-model",
        visibility: "hidden",
        priority: 1,
        supportedReasoningEfforts: ["high"],
      },
    ]);
    expect(commands).toEqual([
      { executable: "codex", args: ["debug", "models"], cwd: "/tmp/project" },
    ]);
  });

  test.each([
    ["command_failed", { stdout: "", stderr: "auth failed", exitCode: 1 }],
    ["malformed_catalog", { stdout: "not json", stderr: "", exitCode: 0 }],
    ["empty_visible_catalog", { stdout: JSON.stringify({ models: [] }), stderr: "", exitCode: 0 }],
  ] as const)("reports %s without launching an agent", async (code, result) => {
    const provider = createCodexModelCatalogProvider(async () => result);
    try {
      await provider("/tmp/project");
      throw new Error("Expected catalog failure");
    } catch (error) {
      expect(error).toBeInstanceOf(CodexModelCatalogError);
      expect((error as CodexModelCatalogError).code).toBe(code);
    }
  });
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk bun test tests/codex-model-catalog.test.ts`

Expected: FAIL because `src/plugins/codex-model-catalog.ts` does not exist.

- [ ] **Step 3: Implement the minimal catalog adapter**

Create `src/plugins/codex-model-catalog.ts` with this public contract:

```ts
import { z } from "zod";
import type { SubprocessCommand, SubprocessResult } from "../process";
import {
  type CodexModelCapability,
  CodexReasoningEffortSchema,
} from "../runtimes/omniskill";

const RawCodexModelSchema = z
  .object({
    slug: z.string().min(1),
    visibility: z.string().min(1),
    priority: z.number().int(),
    supported_reasoning_levels: z
      .array(z.object({ effort: CodexReasoningEffortSchema }).passthrough())
      .min(1),
  })
  .passthrough();

const RawCodexCatalogSchema = z
  .object({ models: z.array(RawCodexModelSchema) })
  .passthrough();

export type CodexModelCatalogCommandRunner = (
  command: SubprocessCommand,
) => Promise<SubprocessResult>;
export type CodexModelCatalogProvider = (cwd: string) => Promise<CodexModelCapability[]>;
export type CodexModelCatalogErrorCode =
  | "command_failed"
  | "malformed_catalog"
  | "empty_visible_catalog";

export class CodexModelCatalogError extends Error {
  constructor(
    public readonly code: CodexModelCatalogErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "CodexModelCatalogError";
  }
}

export function createCodexModelCatalogProvider(
  runCommand: CodexModelCatalogCommandRunner,
): CodexModelCatalogProvider {
  return async (cwd) => {
    const result = await runCommand({ executable: "codex", args: ["debug", "models"], cwd });
    if (result.exitCode !== 0) {
      throw new CodexModelCatalogError(
        "command_failed",
        `Codex model discovery failed. Update Codex or authenticate the intended identity. ${result.stderr.trim()}`,
      );
    }
    let parsed: z.infer<typeof RawCodexCatalogSchema>;
    try {
      parsed = RawCodexCatalogSchema.parse(JSON.parse(result.stdout) as unknown);
    } catch (error) {
      throw new CodexModelCatalogError(
        "malformed_catalog",
        `Codex returned an invalid model catalog. Update Codex and retry. ${String(error)}`,
      );
    }
    const catalog = parsed.models.map((model) => ({
      slug: model.slug,
      visibility: model.visibility,
      priority: model.priority,
      supportedReasoningEfforts: model.supported_reasoning_levels.map(({ effort }) => effort),
    }));
    if (!catalog.some(({ visibility }) => visibility === "list")) {
      throw new CodexModelCatalogError(
        "empty_visible_catalog",
        "Codex exposes no visible models. Update Codex or authenticate the intended identity.",
      );
    }
    return catalog;
  };
}
```

Export it from `src/plugins/index.ts`:

```ts
export * from "./codex-model-catalog";
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `rtk bun test tests/codex-model-catalog.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the catalog adapter**

```bash
rtk git add src/plugins/codex-model-catalog.ts src/plugins/index.ts tests/codex-model-catalog.test.ts
rtk git commit -m "feat: discover Codex orchestration models"
```

### Task 2: Select Defaults and Validate Custom Codex Configuration

**Files:**
- Modify: `src/runtimes/omniskill/orchestration.ts`
- Modify: `tests/orchestration.test.ts`

- [ ] **Step 1: Write failing selection and validation tests**

Add tests that define visible catalog models with different priorities and efforts, then assert:

```ts
const catalog = [
  {
    slug: "gpt-standard",
    visibility: "list",
    priority: 2,
    supportedReasoningEfforts: ["low", "medium"] as const,
  },
  {
    slug: "gpt-frontier",
    visibility: "list",
    priority: 0,
    supportedReasoningEfforts: ["low", "medium", "high"] as const,
  },
  {
    slug: "gpt-hidden",
    visibility: "hidden",
    priority: -1,
    supportedReasoningEfforts: ["high"] as const,
  },
];

expect(createCatalogOrchestrationConfig(catalog).tiers).toEqual({
  deep: {
    codex: [{ model: "gpt-frontier", reasoningEffort: "high" }],
    claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.deep.claude,
  },
  standard: {
    codex: [{ model: "gpt-frontier", reasoningEffort: "medium" }],
    claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.standard.claude,
  },
  fast: {
    codex: [{ model: "gpt-frontier", reasoningEffort: "low" }],
    claude: DEFAULT_ORCHESTRATION_CONFIG.tiers.fast.claude,
  },
});

expect(() =>
  validateCodexOrchestrationConfig(
    OrchestrationConfigSchema.parse({
      ...DEFAULT_ORCHESTRATION_CONFIG,
      tiers: {
        ...DEFAULT_ORCHESTRATION_CONFIG.tiers,
        deep: {
          ...DEFAULT_ORCHESTRATION_CONFIG.tiers.deep,
          codex: [{ model: "missing-model", reasoningEffort: "high" }],
        },
      },
    }),
    catalog,
  ),
).toThrow("deep Codex model missing-model is unavailable");
```

Also assert distinct `OrchestrationModelCompatibilityError.code` values for `tier_effort_unavailable`, `model_unavailable`, and `effort_unsupported`.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk bun test tests/orchestration.test.ts`

Expected: FAIL because catalog selection and validation exports do not exist.

- [ ] **Step 3: Implement pure selection and validation**

In `src/runtimes/omniskill/orchestration.ts`, export the shared effort schema and add:

```ts
export const CodexReasoningEffortSchema = z.enum([
  "none",
  "minimal",
  "low",
  "medium",
  "high",
  "xhigh",
  "max",
  "ultra",
]);

export interface CodexModelCapability {
  slug: string;
  visibility: string;
  priority: number;
  supportedReasoningEfforts: readonly z.infer<typeof CodexReasoningEffortSchema>[];
}

export type OrchestrationModelCompatibilityErrorCode =
  | "tier_effort_unavailable"
  | "model_unavailable"
  | "effort_unsupported";

export class OrchestrationModelCompatibilityError extends Error {
  constructor(
    public readonly code: OrchestrationModelCompatibilityErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "OrchestrationModelCompatibilityError";
  }
}

const tierEffort = { deep: "high", standard: "medium", fast: "low" } as const;

function selectCodexModel(
  tier: OrchestrationTier,
  catalog: readonly CodexModelCapability[],
): { model: string; reasoningEffort: z.infer<typeof CodexReasoningEffortSchema> } {
  const reasoningEffort = tierEffort[tier];
  const selected = catalog
    .filter(
      (model) =>
        model.visibility === "list" && model.supportedReasoningEfforts.includes(reasoningEffort),
    )
    .sort((left, right) => left.priority - right.priority || left.slug.localeCompare(right.slug))[0];
  if (!selected) {
    throw new OrchestrationModelCompatibilityError(
      "tier_effort_unavailable",
      `${tier} requires Codex effort ${reasoningEffort}, but no visible model supports it. Update Codex or authenticate the intended identity.`,
    );
  }
  return { model: selected.slug, reasoningEffort };
}

export function createCatalogOrchestrationConfig(
  catalog: readonly CodexModelCapability[],
): OrchestrationConfig {
  return OrchestrationConfigSchema.parse({
    ...DEFAULT_ORCHESTRATION_CONFIG,
    tiers: Object.fromEntries(
      orchestrationTiers.map((tier) => [
        tier,
        {
          codex: [selectCodexModel(tier, catalog)],
          claude: DEFAULT_ORCHESTRATION_CONFIG.tiers[tier].claude,
        },
      ]),
    ),
  });
}

export function validateCodexOrchestrationConfig(
  config: OrchestrationConfig,
  catalog: readonly CodexModelCapability[],
): void {
  const visibleBySlug = new Map(
    catalog.filter(({ visibility }) => visibility === "list").map((model) => [model.slug, model]),
  );
  for (const tier of orchestrationTiers) {
    for (const candidate of config.tiers[tier].codex) {
      const model = visibleBySlug.get(candidate.model);
      if (!model) {
        throw new OrchestrationModelCompatibilityError(
          "model_unavailable",
          `${tier} Codex model ${candidate.model} is unavailable; edit the custom orchestration configuration or authenticate the intended identity.`,
        );
      }
      if (!model.supportedReasoningEfforts.includes(candidate.reasoningEffort)) {
        throw new OrchestrationModelCompatibilityError(
          "effort_unsupported",
          `${tier} Codex model ${candidate.model} does not support effort ${candidate.reasoningEffort}; edit the custom orchestration configuration.`,
        );
      }
    }
  }
}
```

Use `CodexReasoningEffortSchema` inside `CodexCandidateSchema` to keep one effort contract.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `rtk bun test tests/orchestration.test.ts tests/codex-model-catalog.test.ts`

Expected: PASS.

Run: `rtk bun run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit runtime model selection**

```bash
rtk git add src/runtimes/omniskill/orchestration.ts tests/orchestration.test.ts
rtk git commit -m "feat: select supported orchestration models"
```

### Task 3: Safely Create, Migrate, or Validate the Global Config

**Files:**
- Modify: `src/plugins/agent-profile-installer.ts`
- Modify: `tests/agent-profile-installer.test.ts`

- [ ] **Step 1: Write failing config plan tests**

Extend `tests/agent-profile-installer.test.ts` with a reusable visible catalog and these cases:

```ts
const catalog = [
  {
    slug: "gpt-5.5",
    visibility: "list",
    priority: 0,
    supportedReasoningEfforts: ["low", "medium", "high"] as const,
  },
];

const missing = await loadOrchestrationConfigPlan({ homeDir, codexCatalog: catalog });
expect(missing.status).toBe("create");
expect(missing.config.tiers.deep.codex).toEqual([
  { model: "gpt-5.5", reasoningEffort: "high" },
]);

await writeFile(
  join(homeDir, ".omniskills", "orchestration.json"),
  `${JSON.stringify(DEFAULT_ORCHESTRATION_CONFIG, null, 2)}\n`,
);
const migrated = await loadOrchestrationConfigPlan({ homeDir, codexCatalog: catalog });
expect(migrated.status).toBe("update");

const customContent = `${JSON.stringify(customConfig, null, 2)}\n`;
await writeFile(configPath, customContent);
await expect(
  loadOrchestrationConfigPlan({ homeDir, codexCatalog: catalog }),
).rejects.toThrow("missing-model is unavailable");
expect(await readFile(configPath, "utf8")).toBe(customContent);
```

Add an execution test proving `status: "update"` writes atomically and is restored when a subsequent profile write fails.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk bun test tests/agent-profile-installer.test.ts`

Expected: FAIL because `codexCatalog` and config `update` are unsupported.

- [ ] **Step 3: Implement exact legacy migration and custom validation**

Change `loadOrchestrationConfigPlan` to:

```ts
export async function loadOrchestrationConfigPlan(input: {
  homeDir: string;
  codexCatalog?: readonly CodexModelCapability[];
}): Promise<{
  path: string;
  status: "create" | "update" | "unchanged";
  config: OrchestrationConfig;
  content: string;
}> {
  const path = join(input.homeDir, ".omniskills", orchestrationConfigFileName);
  const legacyContent = `${JSON.stringify(DEFAULT_ORCHESTRATION_CONFIG, null, 2)}\n`;
  const generated = input.codexCatalog
    ? createCatalogOrchestrationConfig(input.codexCatalog)
    : DEFAULT_ORCHESTRATION_CONFIG;
  const generatedContent = `${JSON.stringify(generated, null, 2)}\n`;
  if (!existsSync(path)) {
    return { path, status: "create", config: generated, content: generatedContent };
  }
  const content = await readFile(path, "utf8");
  const config = OrchestrationConfigSchema.parse(JSON.parse(content) as unknown);
  if (input.codexCatalog && content === legacyContent) {
    return { path, status: "update", config: generated, content: generatedContent };
  }
  if (input.codexCatalog) validateCodexOrchestrationConfig(config, input.codexCatalog);
  return { path, status: "unchanged", config, content };
}
```

Update `executeAgentProfilePlan` so config accepts `"create" | "update" | "unchanged"`. Write a create or update config first in the existing transaction: read the prior content when present, write through `.omniskills-tmp`, rename, and add the prior value to the rollback list before profile writes begin. A later profile failure must therefore restore the prior config bytes.

- [ ] **Step 4: Run focused tests**

Run: `rtk bun test tests/agent-profile-installer.test.ts tests/orchestration.test.ts`

Expected: PASS, including unchanged custom-file bytes after validation failure.

- [ ] **Step 5: Commit safe config planning**

```bash
rtk git add src/plugins/agent-profile-installer.ts tests/agent-profile-installer.test.ts
rtk git commit -m "feat: migrate orchestration defaults safely"
```

### Task 4: Persist Adapter Evidence Capability in Dispatch Plans

**Files:**
- Modify: `src/plugins/orchestration-dispatcher.ts`
- Modify: `src/runtimes/omniskill/orchestration-dispatch.ts`
- Modify: `src/plugins/orchestration-run-store.ts`
- Modify: `src/omniskill.ts`
- Modify: `tests/orchestration-dispatcher.test.ts`
- Modify: `tests/orchestration-dispatch.test.ts`
- Modify: `tests/orchestration-run-store.test.ts`
- Modify: `tests/omniskill.test.ts`

- [ ] **Step 1: Write failing public-seam tests**

Assert the concrete dispatcher metadata:

```ts
const dispatcher = createCodexCliDispatcher(async () => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
}));
expect(dispatcher.adapter).toBe("codex-cli");
expect(dispatcher.evidenceCapability).toBe("launch_configured");
```

Change planner fixtures to pass:

```ts
capabilities: {
  codex: {
    available: true,
    adapter: "codex-cli",
    evidenceCapability: "launch_configured",
  },
},
```

Then assert every candidate contains `adapter: "codex-cli"` and `evidenceCapability: "launch_configured"`, does not contain `evidenceRequired`, and the run-store receipt adapter equals `planSet.primary.adapter`.

Update the dispatch dry-run JSON test in `tests/omniskill.test.ts` to require:

```ts
expect.objectContaining({
  adapter: "codex-cli",
  evidenceCapability: "launch_configured",
})
```

and assert `evidenceRequired` is absent.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `rtk bun test tests/orchestration-dispatcher.test.ts tests/orchestration-dispatch.test.ts tests/orchestration-run-store.test.ts`

Expected: FAIL because dispatcher metadata and plan capability fields do not exist.

- [ ] **Step 3: Implement the capability contract**

In `src/runtimes/omniskill/orchestration-dispatch.ts`, add:

```ts
export const DispatchAdapterSchema = z.enum(["codex-cli"]);
export const DispatchCapabilitySchema = z
  .object({
    available: z.boolean(),
    adapter: DispatchAdapterSchema,
    evidenceCapability: z.literal("launch_configured"),
  })
  .strict();
export type DispatchCapability = z.infer<typeof DispatchCapabilitySchema>;
```

Replace `evidenceRequired` in `DispatchPlanSchema` with:

```ts
adapter: DispatchAdapterSchema,
evidenceCapability: z.literal("launch_configured"),
```

Change planner input to `Partial<Record<DispatchRuntime, DispatchCapability>>`, fail when the selected capability is absent or unavailable, and copy its adapter and evidence capability into every candidate.

In `src/plugins/orchestration-dispatcher.ts`, change the interface and return value:

```ts
export interface OrchestrationDispatcher {
  readonly runtime: "codex";
  readonly adapter: "codex-cli";
  readonly evidenceCapability: "launch_configured";
  available(cwd: string): Promise<boolean>;
  dispatch(plan: DispatchPlan): Promise<DispatchAttemptResult>;
  resume(input: {
    plan: DispatchPlan;
    sessionId: string;
    decision: ConsultationDecision;
    message: string;
  }): Promise<DispatchAttemptResult>;
}

return {
  runtime: "codex",
  adapter: "codex-cli",
  evidenceCapability: "launch_configured",
  // existing methods
};
```

In `src/plugins/orchestration-run-store.ts`, replace the hardcoded receipt adapter with `adapter: planSet.primary.adapter`.

Update every `OrchestrationDispatcher` fixture in `tests/omniskill.test.ts` with:

```ts
adapter: "codex-cli",
evidenceCapability: "launch_configured",
```

In dispatch and resume paths in `src/omniskill.ts`, build the capability from the dispatcher instead of passing booleans:

```ts
const capability: DispatchCapability | undefined = dispatcher
  ? {
      available: await dispatcher.available(options.rootDir),
      adapter: dispatcher.adapter,
      evidenceCapability: dispatcher.evidenceCapability,
    }
  : undefined;

capabilities: { ...(capability ? { [runtime]: capability } : {}) },
```

Use the same capability for reassign planning. Text dry-run output must print `Adapter` and `Evidence capability`; it must not label capability as actual evidence.

- [ ] **Step 4: Run focused tests and typecheck**

Run: `rtk bun test tests/orchestration-dispatcher.test.ts tests/orchestration-dispatch.test.ts tests/orchestration-run-store.test.ts tests/omniskill.test.ts`

Expected: PASS.

Run: `rtk bun run typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the dispatch capability contract**

```bash
rtk git add src/omniskill.ts src/plugins/orchestration-dispatcher.ts src/plugins/orchestration-run-store.ts src/runtimes/omniskill/orchestration-dispatch.ts tests/orchestration-dispatcher.test.ts tests/orchestration-dispatch.test.ts tests/orchestration-run-store.test.ts tests/omniskill.test.ts
rtk git commit -m "feat: expose dispatch evidence capability"
```

### Task 5: Wire Discovery and Capability Metadata Through the CLI

**Files:**
- Modify: `src/omniskill.ts`
- Modify: `src/cli.ts`
- Modify: `tests/omniskill.test.ts`
- Modify: `tests/cli.test.ts`

- [ ] **Step 1: Write failing CLI integration tests**

Add a catalog fixture provider:

```ts
const codexModelCatalog = async () => [
  {
    slug: "gpt-5.5",
    visibility: "list",
    priority: 0,
    supportedReasoningEfforts: ["low", "medium", "high"] as const,
  },
];
```

Inject it into Codex orchestration install tests and assert the dry-run plan prints `model=gpt-5.5` without writing configuration, profiles, skills, or workflow state. Add a test that catalog discovery is not called for `--agents claude` and that a discovery failure happens before `installSkill` or profile writes.

- [ ] **Step 2: Run CLI tests and verify they fail**

Run: `rtk bun test tests/omniskill.test.ts tests/cli.test.ts`

Expected: FAIL because the install command does not accept a catalog provider.

- [ ] **Step 3: Inject the catalog provider during install**

Extend `ConfigureOmniskillCommandOptions`:

```ts
codexModelCatalog?: CodexModelCatalogProvider;
```

In `runOmniskillInstall`, compute targets once and discover only for Codex orchestration installs:

```ts
const profileTargets = orchestrationTargets(installAgents);
const codexCatalog =
  bundle.manifest.orchestration && profileTargets.includes("codex")
    ? await requireCodexModelCatalog(options.codexModelCatalog, options.rootDir)
    : undefined;
const configPlan = bundle.manifest.orchestration
  ? await loadOrchestrationConfigPlan({ homeDir, ...(codexCatalog ? { codexCatalog } : {}) })
  : undefined;
```

Implement `requireCodexModelCatalog` so a missing provider fails with an actionable error rather than silently restoring static defaults:

```ts
async function requireCodexModelCatalog(
  provider: CodexModelCatalogProvider | undefined,
  cwd: string,
): Promise<CodexModelCapability[]> {
  if (!provider) {
    throw new Error("Codex model discovery is unavailable; update the Omniskills CLI.");
  }
  return provider(cwd);
}
```

Pass `profileTargets` into `planAgentProfiles`.

- [ ] **Step 4: Wire the real catalog provider**

In `src/cli.ts`:

```ts
configureOmniskillCommand(program, {
  rootDir,
  installSkill,
  printSkillInstallResult,
  installExternalSkillDependency,
  codexModelCatalog: createCodexModelCatalogProvider(runSubprocess),
  dispatchers: { codex: createCodexCliDispatcher(runSubprocess) },
});
```

- [ ] **Step 5: Run integration tests**

Run: `rtk bun test tests/omniskill.test.ts tests/cli.test.ts`

Expected: PASS.

Run: `rtk bun run typecheck`

Expected: PASS with every test dispatcher exposing metadata.

- [ ] **Step 6: Commit CLI wiring**

```bash
rtk git add src/cli.ts src/omniskill.ts tests/cli.test.ts tests/omniskill.test.ts
rtk git commit -m "feat: wire orchestration model discovery"
```

### Task 6: Clarify Startup-Goal Preflight and Refresh the Team Lock

**Files:**
- Modify: `examples/teams/startup-team/skills/startup-goal/SKILL.md`
- Modify: `examples/teams/startup-team/workflow.lock.json`
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `docs/architecture.md`

- [ ] **Step 1: Write the failing coordinator contract assertions**

In `tests/workflow-bundles.test.ts`, extend the existing startup-team skill assertions:

```ts
expect(skill).toContain("evidenceCapability");
expect(skill).toContain("adapter");
expect(skill).toContain("Actual evidence comes only from the dispatch receipt");
expect(skill).toContain("receipt's actual evidence");
expect(skill).not.toContain("If preflight cannot produce at least");
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `rtk bun test tests/workflow-bundles.test.ts`

Expected: FAIL because the skill still conflates preflight capability with produced evidence.

- [ ] **Step 3: Rewrite only the evidence gate**

Replace the relevant Dispatch paragraphs in `examples/teams/startup-team/skills/startup-goal/SKILL.md` with:

```md
Before disclosing model or effort, run an `omniskill dispatch` preflight for
each selected role with `--dry-run --json`. Use only the returned profile,
tier, runtime, model, effort, access, adapter, and `evidenceCapability`.
Generic `spawn_agent` is unverified and cannot satisfy a startup-team tier
assignment. Accept preflight only when the adapter is present and
`evidenceCapability` is at least `launch_configured`. Actual evidence comes
only from the dispatch receipt; dry-run does not prove that a launch occurred.

After execution, require the receipt's actual evidence to be at least
`launch_configured`. If capability preflight or receipt evidence fails, show
the prepared role brief under `Unavailable dispatch` and stop.
```

In `docs/architecture.md`, add that Codex install discovery uses `codex debug models`, custom configuration is validation-only, and plans hold capability while receipts hold actual evidence.

- [ ] **Step 4: Regenerate the startup-team lock**

Run: `rtk bun run dev -- lock examples/teams/startup-team`

Expected: `examples/teams/startup-team/workflow.lock.json` changes only for the startup-goal local skill fingerprint and graph fingerprint implied by it.

- [ ] **Step 5: Validate the public team and run focused tests**

Run: `rtk bun run dev -- validate examples/teams/startup-team`

Expected: PASS.

Run: `rtk bun run dev -- deps examples/teams/startup-team`

Expected: lists the startup-team dependency tree without lock mismatch.

Run: `rtk bun test tests/workflow-bundles.test.ts tests/readme.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit the public contract**

```bash
rtk git add docs/architecture.md examples/teams/startup-team/skills/startup-goal/SKILL.md examples/teams/startup-team/workflow.lock.json tests/workflow-bundles.test.ts
rtk git commit -m "fix: separate orchestration capability from evidence"
```

### Task 7: Full Verification and Global Rollout

**Files:**
- Verify all files changed in Tasks 1-6.
- External managed state after approval: `~/.omniskills/orchestration.json`, `~/.codex/agents/omniskills-startup-team-*.toml`, and `~/.omniskills/runs/startup-team/`.

- [ ] **Step 1: Run formatting, type, test, and coverage gates**

Run: `rtk bun run check`

Expected: Biome, typecheck, all Bun tests, and the 90% line coverage gate PASS.

- [ ] **Step 2: Inspect the final diff and audit scope**

Run: `rtk git status --short`

Expected: only the planned source, tests, docs, skill, lock, and Ponytrail records are changed.

Run: `rtk git diff --check`

Expected: no whitespace errors.

Run: `rtk git diff --stat HEAD~6..HEAD`

Expected: the diff is limited to the orchestration capability/catalog slice.

- [ ] **Step 3: Reinstall startup-team globally with explicit external-write approval**

Run outside the workspace sandbox only after approval:

```bash
rtk bun run dev -- install examples/teams/startup-team --home ~ --agents codex
```

Expected: the exact legacy generated config migrates to currently visible Codex models, managed profiles update, and custom/drifted files still fail closed.

- [ ] **Step 4: Inspect installed configuration and profile hashes**

Read `~/.omniskills/orchestration.json` and the installed `startup-team` workflow record. Confirm every Codex profile model/effort exists in `rtk codex debug models`, and confirm each artifact hash matches its managed profile content.

Expected: deep uses a visible high-capable model, standard a medium-capable model, fast a low-capable model, and no installed profile references `gpt-5.6` unless the live catalog actually exposes it.

- [ ] **Step 5: Run CTO and QA dry-run preflights**

```bash
rtk bun run dev -- dispatch startup-team --role catalog:cto --task "Review the orchestration capability and model-discovery implementation for architecture risks." --runtime codex --home ~ --dry-run --json
rtk bun run dev -- dispatch startup-team --role catalog:qa-lead --task "Review the orchestration capability and model-discovery implementation for regression and release risks." --runtime codex --home ~ --dry-run --json
```

Expected: both plans disclose profile, tier, runtime, adapter `codex-cli`, model, effort, read-only access, and `evidenceCapability: launch_configured`; neither creates run state.

- [ ] **Step 6: Launch both read-only reviews and inspect receipts**

Run the same two commands without `--dry-run`, keeping `--json`.

Expected: each creates a disclosed run ID and receipt. Each receipt reports actual evidence `launch_configured` or `runtime_reported`; any consultation, mismatch, or catalog failure stops and is reported rather than being silently downgraded.

- [ ] **Step 7: Record final review findings and verification evidence**

Summarize the CTO and QA findings together. Report run IDs, adapter, tier, model, effort, access, actual receipt evidence, commands run, and any residual risks: early cancellation, Claude adapter support, run-level lease/CAS, and lower-tier approved fallback remain out of scope.

- [ ] **Step 8: Commit any verification-only corrections**

If verification required a scoped correction, repeat its focused red-green cycle and commit it separately. If no correction was needed, do not create an empty commit.
