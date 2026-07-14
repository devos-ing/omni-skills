# Startup Team Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a first-class Omniskills team manifest and publish the existing startup role bundle as `startup-team` while preserving `$startup-goal` as its coordinator.

**Architecture:** Extend the existing `workflow.json` schema with a backward-compatible `kind` discriminator plus team-only `coordinator` and `members` fields. Reuse the workflow loader and skill installer, route `-team` aliases to `examples/teams/`, and keep package identity separate from coordinator skill identity across CLI, docs, and landing content.

**Tech Stack:** Bun, TypeScript, Zod, Commander, Bun test, Next.js/React landing app, Biome, Ponytrail snapshots

---

## Execution rules

- Run every shell command through `rtk`.
- Follow test-first order: failing assertion, observed failure, minimal implementation, passing assertion.
- Before each file-mutation group, use the `pony-trail` helper to record the exact files, purpose, expected result, verification, and rollback; immediately record the matching post snapshot.
- Stage only the files listed for the current task. The worktree may contain unrelated user changes.
- Do not edit historical files under `docs/superpowers/specs/` or older files under `docs/superpowers/plans/` during the migration.
- Preserve `$startup-goal` and `/startup-goal` wherever they mean coordinator invocation. Rename only the installable package, catalog path, source URL, and package-facing labels.

## File map

| File | Responsibility |
| --- | --- |
| `src/runtimes/omniskill/workflow-bundles.ts` | Manifest schema, cross-field validation, alias catalog routing, lock and installed-record behavior |
| `tests/workflow-bundles.test.ts` | Schema, alias, installed metadata, bundle contract, and role-contract coverage |
| `src/omniskill.ts` | Type-neutral CLI descriptions and arguments |
| `tests/omniskill.test.ts` | CLI command-description contract |
| `examples/teams/startup-team/workflow.json` | Startup Team identity, roster, skills, and execution steps |
| `examples/teams/startup-team/workflow.lock.json` | Generated skill fingerprints for `startup-team@0.2.0` |
| `examples/teams/startup-team/README.md` | Team author/install instructions |
| `examples/teams/startup-team/skills/**` | Existing coordinator and role skills, moved without role-behavior changes |
| `README.md` | Primary install example and public workflow/team catalog |
| `docs/workflow-author-guide.md` | Authoring and install commands for the team catalog |
| `tests/readme.test.ts` | Root README package/coordinator distinction |
| `landing/lib/landing-content.ts` | Startup Team card, commands, source URL, and coordinator metadata |
| `landing/components/landing-page.tsx` | Hero install fallback and copy affordance label |
| `landing/components/workflow-run-demo.tsx` | Coordinator demo and local-skill source base URL |
| `landing/components/flow-diagram.tsx` | Coordinator invocation diagram; inspected but intentionally remains `/startup-goal` |
| `docs/landing-content.md` | English landing content contract |
| `docs/landing-content.zh-Hant.md` | Traditional Chinese landing content contract |
| `tests/landing-app.test.ts` | Landing package, command, URL, and coordinator-invocation contract |

### Task 1: Add the first-class team manifest schema

**Files:**
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `src/runtimes/omniskill/workflow-bundles.ts`

- [ ] **Step 1: Add a valid team fixture and failing schema tests**

Import `WorkflowBundleManifestSchema` in `tests/workflow-bundles.test.ts`, then add this fixture above the main `describe` block:

```ts
const validTeamManifest = {
  schemaVersion: "0.1",
  kind: "team",
  name: "test-team",
  version: "0.1.0",
  description: "A test team with one coordinator and one member.",
  coordinator: "./skills/coordinator",
  members: ["./skills/member"],
  skills: [
    { source: "./skills/coordinator", entry: true },
    { source: "./skills/member" },
    { source: "external-review" },
  ],
  steps: [
    { id: "route", title: "Route work", skill: "./skills/coordinator" },
    { id: "review", title: "Review work", skill: "./skills/member" },
  ],
} as const;
```

Add focused tests inside `describe("workflow bundles", ...)`:

```ts
test("parses first-class team metadata while legacy manifests remain workflows", () => {
  const team = WorkflowBundleManifestSchema.parse(validTeamManifest);
  const legacy = WorkflowBundleManifestSchema.parse({
    schemaVersion: "0.1",
    name: "legacy-workflow",
    version: "0.1.0",
    description: "A legacy workflow without an explicit kind.",
    skills: [{ source: "skill-a" }],
    steps: [{ id: "run", title: "Run", skill: "skill-a" }],
  });

  expect(team.kind).toBe("team");
  expect(team.coordinator).toBe("./skills/coordinator");
  expect(team.members).toEqual(["./skills/member"]);
  expect(legacy.kind).toBeUndefined();
  expect(getWorkflowInvocationSkillName(team)).toBe("coordinator");
  expect(getWorkflowInvocationSkillName(legacy)).toBeNull();
});

test("rejects invalid team coordinator and member contracts", () => {
  const invalidCases = [
    {
      manifest: { ...validTeamManifest, coordinator: undefined },
      message: "Team manifests must declare a coordinator",
    },
    {
      manifest: { ...validTeamManifest, members: [] },
      message: "Team manifests must declare at least one member",
    },
    {
      manifest: { ...validTeamManifest, coordinator: "./skills/missing" },
      message: "Team coordinator references unknown skill: ./skills/missing",
    },
    {
      manifest: { ...validTeamManifest, coordinator: "external-review" },
      message: "Team coordinator must be a local skill path: external-review",
    },
    {
      manifest: { ...validTeamManifest, members: ["./skills/missing"] },
      message: "Team member references unknown skill: ./skills/missing",
    },
    {
      manifest: { ...validTeamManifest, members: ["external-review"] },
      message: "Team member must be a local skill path: external-review",
    },
    {
      manifest: { ...validTeamManifest, members: ["./skills/member", "./skills/member"] },
      message: "Duplicate team member: ./skills/member",
    },
    {
      manifest: { ...validTeamManifest, members: ["./skills/coordinator"] },
      message: "Team coordinator cannot also be a member: ./skills/coordinator",
    },
  ];

  for (const invalidCase of invalidCases) {
    expect(() => WorkflowBundleManifestSchema.parse(invalidCase.manifest)).toThrow(
      invalidCase.message,
    );
  }
});

test("rejects team-only metadata on workflow manifests", () => {
  expect(() =>
    WorkflowBundleManifestSchema.parse({ ...validTeamManifest, kind: "workflow" }),
  ).toThrow("Workflow manifests cannot declare coordinator or members");
});
```

- [ ] **Step 2: Run the schema tests and observe the failure**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "team metadata|team coordinator|team-only"
```

Expected: FAIL because `kind`, `coordinator`, and `members` are not part of the schema and no team validation exists.

- [ ] **Step 3: Extend the manifest schema with minimal cross-field validation**

Add these optional fields to the existing Zod object in `src/runtimes/omniskill/workflow-bundles.ts`:

```ts
kind: z.enum(["workflow", "team"]).optional(),
coordinator: z.string().min(1).optional(),
members: z.array(z.string().min(1)).optional(),
```

At the start of the existing `.superRefine`, after `skillSources` is created, add team validation with these rules and messages:

```ts
const effectiveKind = manifest.kind ?? "workflow";

if (effectiveKind === "team") {
  if (!manifest.coordinator) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Team manifests must declare a coordinator",
      path: ["coordinator"],
    });
  } else {
    if (!skillSources.has(manifest.coordinator)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Team coordinator references unknown skill: ${manifest.coordinator}`,
        path: ["coordinator"],
      });
    }
    if (!isLocalWorkflowSkillSource(manifest.coordinator)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Team coordinator must be a local skill path: ${manifest.coordinator}`,
        path: ["coordinator"],
      });
    }
  }

  if (!manifest.members || manifest.members.length === 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Team manifests must declare at least one member",
      path: ["members"],
    });
  } else {
    const seenMembers = new Set<string>();
    for (const [index, member] of manifest.members.entries()) {
      if (!skillSources.has(member)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Team member references unknown skill: ${member}`,
          path: ["members", index],
        });
      }
      if (!isLocalWorkflowSkillSource(member)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Team member must be a local skill path: ${member}`,
          path: ["members", index],
        });
      }
      if (seenMembers.has(member)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate team member: ${member}`,
          path: ["members", index],
        });
      }
      if (member === manifest.coordinator) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Team coordinator cannot also be a member: ${member}`,
          path: ["members", index],
        });
      }
      seenMembers.add(member);
    }
  }
} else if (manifest.coordinator !== undefined || manifest.members !== undefined) {
  context.addIssue({
    code: z.ZodIssueCode.custom,
    message: "Workflow manifests cannot declare coordinator or members",
    path: [manifest.coordinator !== undefined ? "coordinator" : "members"],
  });
}
```

Place `skillSources` before this block and retain the existing step, entry-skill, and loop validation below it.

Export a small display helper from the same runtime module so CLI output can derive the callable skill from validated team metadata:

```ts
export function getWorkflowInvocationSkillName(
  manifest: WorkflowBundleManifest,
): string | null {
  if (manifest.kind !== "team" || !manifest.coordinator) {
    return null;
  }
  return basename(manifest.coordinator);
}
```

Import `getWorkflowInvocationSkillName` in the test alongside `WorkflowBundleManifestSchema`. Do not hard-code `startup-goal` in this helper.

- [ ] **Step 4: Run focused and full runtime tests**

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "team metadata|team coordinator|team-only"
rtk bun test tests/workflow-bundles.test.ts
```

Expected: the new tests pass and the existing workflow tests remain green.

- [ ] **Step 5: Commit the schema slice**

```bash
rtk git add src/runtimes/omniskill/workflow-bundles.ts tests/workflow-bundles.test.ts
rtk git commit -m "feat: add first-class team manifests"
```

### Task 2: Route team aliases through the team catalog

**Files:**
- Modify: `tests/workflow-bundles.test.ts`
- Modify: `src/runtimes/omniskill/workflow-bundles.ts`

- [ ] **Step 1: Add a reusable on-disk team fixture**

Add this helper near the other test helpers in `tests/workflow-bundles.test.ts`:

```ts
async function writeTeamBundleFixtureAt(bundleDir: string, kind: "team" | "workflow" = "team") {
  await mkdir(join(bundleDir, "skills", "coordinator"), { recursive: true });
  await mkdir(join(bundleDir, "skills", "member"), { recursive: true });
  await writeFile(
    join(bundleDir, "skills", "coordinator", "SKILL.md"),
    '---\nname: coordinator\ndescription: "Coordinate the team."\n---\n',
  );
  await writeFile(
    join(bundleDir, "skills", "member", "SKILL.md"),
    '---\nname: member\ndescription: "Act as a team member."\n---\n',
  );
  await writeFile(
    join(bundleDir, "workflow.json"),
    `${JSON.stringify(
      {
        schemaVersion: "0.1",
        kind,
        name: "fixture-team",
        version: "0.1.0",
        description: "Team alias fixture.",
        ...(kind === "team"
          ? { coordinator: "./skills/coordinator", members: ["./skills/member"] }
          : {}),
        skills: [
          { source: "./skills/coordinator", entry: true },
          { source: "./skills/member" },
        ],
        steps: [{ id: "route", title: "Route", skill: "./skills/coordinator" }],
      },
      null,
      2,
    )}\n`,
  );
}
```

- [ ] **Step 2: Add failing alias-path and kind-mismatch tests**

```ts
test("resolves team aliases from examples/teams and retains team metadata", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "workflow-team-alias-"));
  let checkoutDir = "";

  const bundle = await loadWorkflowBundle("startup-team", {
    tempDir,
    runGitCommand: async (command) => {
      if (command.args[0] === "clone") {
        checkoutDir = command.args.at(-1) ?? "";
        await writeTeamBundleFixtureAt(
          join(checkoutDir, "examples", "teams", "startup-team"),
        );
        return { stdout: "", stderr: "", exitCode: 0 };
      }
      return { stdout: "abc123\n", stderr: "", exitCode: 0 };
    },
  });

  expect(bundle.manifest.kind).toBe("team");
  expect(bundle.manifest.coordinator).toBe("./skills/coordinator");
  expect(bundle.manifest.members).toEqual(["./skills/member"]);
  expect(bundle.source).toEqual({
    kind: "git",
    url: "https://github.com/devos-ing/omni-skills.git#examples/teams/startup-team",
    commit: "abc123",
    subdirectory: "examples/teams/startup-team",
  });

  await bundle.cleanup?.();
  await expect(stat(checkoutDir)).rejects.toThrow();
  await rm(tempDir, { recursive: true, force: true });
});

test("rejects a workflow manifest resolved through a team alias", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "workflow-team-kind-mismatch-"));

  await expect(
    loadWorkflowBundle("startup-team", {
      tempDir,
      runGitCommand: async (command) => {
        if (command.args[0] === "clone") {
          const checkoutDir = command.args.at(-1) ?? "";
          await writeTeamBundleFixtureAt(
            join(checkoutDir, "examples", "teams", "startup-team"),
            "workflow",
          );
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      },
    }),
  ).rejects.toThrow('Omniskills team alias "startup-team" must resolve to kind: "team"');

  await rm(tempDir, { recursive: true, force: true });
});

test("does not redirect the startup-goal alias to startup-team", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "workflow-startup-goal-alias-"));

  await expect(
    loadWorkflowBundle("startup-goal", {
      tempDir,
      runGitCommand: async (command) => {
        if (command.args[0] === "clone") {
          const checkoutDir = command.args.at(-1) ?? "";
          await mkdir(join(checkoutDir, "examples", "workflows"), { recursive: true });
          await writeTeamBundleFixtureAt(
            join(checkoutDir, "examples", "teams", "startup-team"),
          );
          return { stdout: "", stderr: "", exitCode: 0 };
        }
        return { stdout: "abc123\n", stderr: "", exitCode: 0 };
      },
    }),
  ).rejects.toThrow(
    "Omniskills workflow alias not found: startup-goal\nChecked: https://github.com/devos-ing/omni-skills.git#examples/workflows/startup-goal",
  );

  await rm(tempDir, { recursive: true, force: true });
});
```

- [ ] **Step 3: Run the alias tests and observe the wrong catalog path**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "team aliases|team alias|does not redirect"
```

Expected: FAIL because `startup-team` resolves to `examples/workflows/startup-team` and no alias-kind check exists.

- [ ] **Step 4: Implement reusable team catalog routing and kind enforcement**

Add beside `canonicalExamplesWorkflowPath`:

```ts
const canonicalExamplesTeamPath = "examples/teams";
```

Change `parseWorkflowAliasSource` to select the catalog by suffix:

```ts
function parseWorkflowAliasSource(source: string): GitWorkflowSource | null {
  if (!workflowAliasPattern.test(source)) {
    return null;
  }

  const catalogPath = source.endsWith("-team")
    ? canonicalExamplesTeamPath
    : canonicalExamplesWorkflowPath;
  const url = `${canonicalExamplesGitUrl}#${catalogPath}/${source}`;
  const gitSource = parseGitWorkflowSource(url);
  if (!gitSource) {
    throw new Error(`Could not build canonical Omniskills alias URL: ${source}`);
  }

  return { ...gitSource, alias: source };
}
```

Immediately after parsing the manifest in `loadWorkflowBundle`, enforce the catalog contract:

```ts
const manifest = WorkflowBundleManifestSchema.parse(JSON.parse(rawManifest));
if (resolvedSource.alias?.endsWith("-team") && manifest.kind !== "team") {
  throw new Error(
    `Omniskills team alias "${resolvedSource.alias}" must resolve to kind: "team"`,
  );
}
```

Keep direct local paths and full git URLs manifest-driven; only a bare `-team` alias enforces the team catalog kind.

- [ ] **Step 5: Verify alias behavior and installed metadata**

Insert this block in the valid alias test before `await bundle.cleanup?.()`:

```ts
const installRoot = await mkdtemp(join(tmpdir(), "workflow-team-install-"));
const install = await installWorkflowBundle({ rootDir: installRoot, bundle });
expect(install.workflow.kind).toBe("team");
expect(install.workflow.coordinator).toBe("./skills/coordinator");
expect(install.workflow.members).toEqual(["./skills/member"]);
await rm(installRoot, { recursive: true, force: true });
```

Run:

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "team aliases|team alias"
rtk bun test tests/workflow-bundles.test.ts
```

Expected: PASS. The installed record retains the team fields because `installWorkflowBundle` already spreads the validated manifest.

- [ ] **Step 6: Commit the catalog slice**

```bash
rtk git add src/runtimes/omniskill/workflow-bundles.ts tests/workflow-bundles.test.ts
rtk git commit -m "feat: resolve team catalog aliases"
```

### Task 3: Move and rename the Startup Team bundle

**Files:**
- Move: `examples/workflows/startup-goal/**` to `examples/teams/startup-team/**`
- Modify: `examples/teams/startup-team/workflow.json`
- Modify: `examples/teams/startup-team/workflow.lock.json`
- Modify: `examples/teams/startup-team/README.md`
- Modify: `tests/workflow-bundles.test.ts`

- [ ] **Step 1: Change the bundle contract test to the approved team path and roster**

Update `readStartupRoleSkill` and the startup bundle test to resolve:

```ts
join(import.meta.dir, "..", "examples", "teams", "startup-team")
```

Rename the test to `"startup team entry skill dispatches role subagents and combines results"` and add:

```ts
expect(bundle.manifest).toMatchObject({
  kind: "team",
  name: "startup-team",
  version: "0.2.0",
  coordinator: "./skills/startup-goal",
  members: [
    "./skills/ceo",
    "./skills/cto",
    "./skills/product-manager",
    "./skills/web-design",
    "./skills/engineering-manager",
    "./skills/founding-engineer",
    "./skills/qa-lead",
  ],
});
expect(
  bundle.manifest.skills.find((skill) => skill.source === bundle.manifest.coordinator),
).toEqual({ source: "./skills/startup-goal", entry: true });
expect(bundle.lock?.workflow).toBe("startup-team");
expect(bundle.lock?.workflowVersion).toBe("0.2.0");
```

Remove `startup-goal` from arrays that assume every curated bundle lives under `examples/workflows/`. Add a separate `startup-team` load from `examples/teams/startup-team` to the curated-lock and Matt Pocock catalog tests.

- [ ] **Step 2: Run the contract test and observe the missing path**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "startup team|curated workflow examples|Matt Pocock"
```

Expected: FAIL because `examples/teams/startup-team` does not exist.

- [ ] **Step 3: Move the directory without changing the skill roster**

```bash
rtk git mv examples/workflows/startup-goal examples/teams/startup-team
```

Do not rename `skills/startup-goal` or change its frontmatter `name: startup-goal`.

- [ ] **Step 4: Update the team manifest identity and metadata**

In `examples/teams/startup-team/workflow.json`, set:

```json
{
  "schemaVersion": "0.1",
  "kind": "team",
  "name": "startup-team",
  "version": "0.2.0",
  "description": "Install a startup team as one goal-oriented Omniskills bundle: a startup-goal coordinator plus CEO, CTO, product manager, web-design lead, engineering manager, founding engineer, and QA lead.",
  "coordinator": "./skills/startup-goal",
  "members": [
    "./skills/ceo",
    "./skills/cto",
    "./skills/product-manager",
    "./skills/web-design",
    "./skills/engineering-manager",
    "./skills/founding-engineer",
    "./skills/qa-lead"
  ]
}
```

Retain the existing full `skills[]` and `steps[]` arrays exactly, including brainstorming, route approval, implementation, and QA.

- [ ] **Step 5: Update the bundle README and regenerate the lock**

Change the heading to `# Startup Team Omniskills Bundle`, explain that `$startup-goal` is the coordinator, and update all local commands to `examples/teams/startup-team`.

Regenerate the lock:

```bash
rtk bun run dev -- lock examples/teams/startup-team
```

Expected output includes `Omniskills lock written: startup-team`. Inspect the generated lock and require:

```json
{
  "workflow": "startup-team",
  "workflowVersion": "0.2.0"
}
```

- [ ] **Step 6: Verify the moved bundle contract**

```bash
rtk bun test tests/workflow-bundles.test.ts --test-name-pattern "startup team|curated workflow examples|Matt Pocock"
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- deps examples/teams/startup-team
```

Expected: PASS; validation reports `startup-team@0.2.0`, and dependencies still include the coordinator, all members, companions, and `implement`.

- [ ] **Step 7: Commit the bundle migration**

```bash
rtk git add examples/teams/startup-team tests/workflow-bundles.test.ts
rtk git commit -m "feat: publish the startup team bundle"
```

### Task 4: Make CLI descriptions include teams

**Files:**
- Modify: `tests/omniskill.test.ts`
- Modify: `src/omniskill.ts`

- [ ] **Step 1: Add a failing command-description contract**

Add this test near the existing command-registration tests:

```ts
test("describes bundle commands as supporting workflows and teams", () => {
  const program = new Command();
  configureOmniskillCommand(program, {
    rootDir: process.cwd(),
    installSkill: async () => {
      throw new Error("install is not exercised by command-description tests");
    },
    printSkillInstallResult: () => {},
  });

  const descriptions = new Map(
    program.commands.map((command) => [command.name(), command.description()]),
  );
  expect(descriptions.get("install")).toBe(
    "Install an Omniskills workflow or team and its skills.",
  );
  expect(descriptions.get("list")).toBe("List installed Omniskills workflows and teams.");
  expect(descriptions.get("remove")).toBe(
    "Remove an installed Omniskills workflow or team and its recorded skill artifacts.",
  );
  expect(descriptions.get("deps")).toBe(
    "List the skill dependencies declared by an Omniskills workflow or team.",
  );
});
```

- [ ] **Step 2: Run the test and observe workflow-only descriptions**

```bash
rtk bun test tests/omniskill.test.ts --test-name-pattern "supporting workflows and teams"
```

Expected: FAIL on the current workflow-only descriptions.

- [ ] **Step 3: Update only user-facing Commander descriptions and source arguments**

In `src/omniskill.ts`, use these exact descriptions:

```ts
"Install an Omniskills workflow or team and its skills."
"List installed Omniskills workflows and teams."
"Remove an installed Omniskills workflow or team and its recorded skill artifacts."
"List the skill dependencies declared by an Omniskills workflow or team."
```

Change source argument help from `workflow alias` to `workflow or team alias`, and the remove argument help from `installed Omniskills workflow name` to `installed Omniskills workflow or team name`.

Do not rename internal functions, record directories, or compatibility command groups.

- [ ] **Step 4: Add a failing team install next-step test**

Extend `writeGitWorkflowFixtureAt` with a `team?: boolean` option. When true, create the existing `git-extra` skill, mark `./skills/git-entry` as `entry: true`, and add these manifest properties:

```ts
kind: "team",
name: "git-team",
coordinator: "./skills/git-entry",
members: ["./skills/git-extra"],
```

Add an install test that writes `writeGitWorkflowFixtureAt(bundleDir, { team: true, extraSkill: true })`, captures console output, and asserts:

```ts
expect(output).toContain("Omniskills installed: git-team");
expect(output).toContain("Next: $git-entry");
expect(output).not.toContain("$startup-goal");
```

Run:

```bash
rtk bun test tests/omniskill.test.ts --test-name-pattern "team users to invoke"
```

Expected: FAIL because successful installs do not print a coordinator invocation step.

- [ ] **Step 5: Print the invocation hint from validated team metadata**

Import `getWorkflowInvocationSkillName` from `./runtimes/omniskill` in `src/omniskill.ts`. Immediately after the install result box is printed, add:

```ts
const invocationSkillName = getWorkflowInvocationSkillName(bundle.manifest);
if (invocationSkillName) {
  console.log(nextStep(`$${invocationSkillName}`));
}
```

This keeps the CLI generic: `startup-goal` comes from `coordinator`, not from a startup-specific conditional.

- [ ] **Step 6: Verify CLI tests and help smoke output**

```bash
rtk bun test tests/omniskill.test.ts --test-name-pattern "supporting workflows and teams|team users to invoke"
rtk bun test tests/cli.test.ts tests/omniskill.test.ts
rtk bun run dev -- --help
```

Expected: tests pass and help describes installable workflows and teams without changing command names.

- [ ] **Step 7: Commit the CLI wording and invocation slice**

```bash
rtk git add src/omniskill.ts tests/omniskill.test.ts
rtk git commit -m "feat: show the team coordinator after install"
```

### Task 5: Update root documentation and author guidance

**Files:**
- Modify: `tests/readme.test.ts`
- Modify: `README.md`
- Modify: `docs/workflow-author-guide.md`

- [ ] **Step 1: Change README tests to distinguish package from coordinator**

Update the first-screen and catalog assertions to require:

```ts
expect(firstScreen).toContain("Startup Team");
expect(readme).toContain("npx omniskill@latest install startup-team");
expect(readme).toContain(
  "npx omniskill@latest install 'https://github.com/devos-ing/omni-skills.git#examples/teams/startup-team'",
);
expect(readme).toContain("examples/teams/startup-team");
expect(readme).toContain(
  "$startup-goal I have an AI bookkeeping idea; help me choose the wedge and ship a v1 in two weeks",
);
expect(readme).not.toContain("npx omniskill@latest install startup-goal");
expect(readme).not.toContain("examples/workflows/startup-goal");
```

Rename the test description from `documents startup-goal` to `documents startup-team and its startup-goal coordinator`.

- [ ] **Step 2: Run README tests and observe stale package references**

```bash
rtk bun test tests/readme.test.ts
```

Expected: FAIL on Startup Goal package labels, install commands, and the old path.

- [ ] **Step 3: Update README package-facing content**

Apply this terminology matrix throughout `README.md`:

| Old package-facing text | New text |
| --- | --- |
| `Startup Goal` | `Startup Team` |
| `install startup-goal` | `install startup-team` |
| `examples/workflows/startup-goal` | `examples/teams/startup-team` |
| Startup Goal catalog row | Startup Team catalog row |

Preserve `$startup-goal` command examples and explicitly describe it as the installed team's coordinator.

- [ ] **Step 4: Update author-guide commands and explanation**

In `docs/workflow-author-guide.md`, change validation, dependency, and install examples to `examples/teams/startup-team` or the `startup-team` alias. Replace `Install startup-goal when you want the full role bench` with:

```markdown
Install `startup-team` when you want the full role bench. Invoke its
`$startup-goal` coordinator to clarify, route, dispatch, and combine the work.
```

Do not change unrelated individual-role workflow examples.

- [ ] **Step 5: Verify documentation contracts**

```bash
rtk bun test tests/readme.test.ts
rtk rg -n 'npx omniskill@latest install startup-goal|examples/workflows/startup-goal' README.md docs/workflow-author-guide.md
```

Expected: README tests pass and the literal audit returns no output.

- [ ] **Step 6: Commit the primary documentation slice**

```bash
rtk git add README.md docs/workflow-author-guide.md tests/readme.test.ts
rtk git commit -m "docs: rename the startup package to startup team"
```

### Task 6: Update landing content and preserve coordinator demos

**Files:**
- Modify: `tests/landing-app.test.ts`
- Modify: `landing/lib/landing-content.ts`
- Modify: `landing/components/landing-page.tsx`
- Modify: `landing/components/workflow-run-demo.tsx`
- Inspect without changing unless required: `landing/components/flow-diagram.tsx`
- Modify: `docs/landing-content.md`
- Modify: `docs/landing-content.zh-Hant.md`

- [ ] **Step 1: Change landing source-contract assertions first**

Update package-facing assertions in `tests/landing-app.test.ts`:

```ts
expect(content).toContain("Startup Team");
expect(content).toContain("npx omniskill@latest install startup-team");
expect(content).toContain("npx omniskill@latest deps startup-team");
expect(content).toContain("npx omniskill@latest lock examples/teams/startup-team");
expect(content).toContain("npx omniskill@latest remove startup-team");
expect(content).toContain('slug: "startup-team"');
expect(content).toContain(`\${githubUrl}/tree/main/examples/teams/startup-team`);
expect(content).not.toContain("npx omniskill@latest install startup-goal");
expect(content).not.toContain("examples/workflows/startup-goal");
```

Update component-source assertions to require:

```ts
expect(landingPage).toContain('copyLabel="Copy startup-team install command"');
expect(workflowRunDemo).toContain(
  "https://github.com/devos-ing/omni-skills/blob/main/examples/teams/startup-team/skills",
);
```

Keep the existing `/startup-goal` prompts and `See startup-goal coordinate the work.` assertions.

- [ ] **Step 2: Run landing tests and observe stale package identity**

```bash
rtk bun test tests/landing-app.test.ts
```

Expected: FAIL on the old slug, install commands, labels, and source URLs.

- [ ] **Step 3: Update the landing catalog data**

In `landing/lib/landing-content.ts`, update the first catalog item:

```ts
{
  slug: "startup-team",
  name: "Startup Team",
  description:
    "Install a startup operating team with a startup-goal coordinator and specialist roles for strategy, product, design, architecture, delivery, implementation, and QA.",
  entrySkill: "startup-goal",
  tag: "Team",
  sourceUrl: `${githubUrl}/tree/main/examples/teams/startup-team`,
  installCommand: "npx omniskill@latest install startup-team",
}
```

Retain the existing `localSkillNames`, `skills`, `diagramSteps`, and coordinator skill description. Update command examples to:

```ts
{ label: "Install Startup Team", command: "npx omniskill@latest install startup-team" }
{ label: "Inspect Startup Team deps", command: "npx omniskill@latest deps startup-team" }
{ label: "Lock skill fingerprints", command: "npx omniskill@latest lock examples/teams/startup-team" }
{ label: "Remove installed team", command: "npx omniskill@latest remove startup-team" }
```

- [ ] **Step 4: Update component package labels and source links**

In `landing/components/landing-page.tsx`:

```ts
const heroInstallCommand = commands[0]?.command ?? "npx omniskill@latest install startup-team";
```

Change the install copy label to `Copy startup-team install command`. Keep `/startup-goal` chat examples and `See startup-goal coordinate the work.`

In `landing/components/workflow-run-demo.tsx`, change only the local-skill source base URL to:

```ts
"https://github.com/devos-ing/omni-skills/blob/main/examples/teams/startup-team/skills";
```

Keep `WorkflowSkillName`'s `"startup-goal"`, coordinator metadata, case prompts, and workbench label because they describe the callable skill rather than the package.

Inspect `landing/components/flow-diagram.tsx`; its `/startup-goal` and `startup-goal entry skill` values are correct and should remain unchanged.

- [ ] **Step 5: Update English and Traditional Chinese content mirrors**

In both landing-content documents:

- rename the catalog/package heading to Startup Team;
- change slug and install/deps/remove commands to `startup-team`;
- change local authoring paths and source URLs to `examples/teams/startup-team`;
- describe `startup-goal` as the coordinator/entry skill;
- preserve every `$startup-goal` prompt and ordered `Route -> startup-goal` step.

Use `Startup Team` in English and `Startup Team` as the stable product label in Traditional Chinese; explain the coordinator in Chinese rather than transliterating the skill name.

- [ ] **Step 6: Verify landing behavior and mirrored content**

```bash
rtk bun test tests/landing-app.test.ts
rtk bun --cwd landing run typecheck
rtk rg -n 'npx omniskill@latest install startup-goal|examples/workflows/startup-goal' landing docs/landing-content.md docs/landing-content.zh-Hant.md
```

Expected: landing tests and typecheck pass; the stale package/path audit returns no output. `/startup-goal` coordinator prompts remain present.

- [ ] **Step 7: Commit the landing slice**

```bash
rtk git add landing/lib/landing-content.ts landing/components/landing-page.tsx landing/components/workflow-run-demo.tsx docs/landing-content.md docs/landing-content.zh-Hant.md tests/landing-app.test.ts
rtk git commit -m "feat: present startup team on the landing page"
```

### Task 7: Run migration audits and the full repository gate

**Files:**
- Verify: all files changed in Tasks 1-6

- [ ] **Step 1: Audit stale package commands and paths**

```bash
rtk rg -n 'npx omniskill@latest (install|deps) startup-goal|examples/workflows/startup-goal' README.md docs/workflow-author-guide.md docs/landing-content.md docs/landing-content.zh-Hant.md landing examples src
```

Expected: no output. Historical design and plan files are intentionally outside this audit.

- [ ] **Step 2: Confirm coordinator invocation survived the rename**

```bash
rtk rg -n '\$startup-goal|/startup-goal' README.md docs/workflow-author-guide.md docs/landing-content.md docs/landing-content.zh-Hant.md landing examples/teams/startup-team
```

Expected: coordinator examples appear across the README, team skill, landing content, and workbench demo.

- [ ] **Step 3: Run focused runtime and public-surface tests**

```bash
rtk bun test tests/workflow-bundles.test.ts
rtk bun test tests/omniskill.test.ts tests/cli.test.ts
rtk bun test tests/readme.test.ts tests/landing-app.test.ts
```

Expected: all focused suites pass.

- [ ] **Step 4: Run required CLI smoke checks**

```bash
rtk bun run dev -- validate examples/teams/startup-team
rtk bun run dev -- deps examples/teams/startup-team
rtk bun run dev -- --help
```

Expected: the team validates as `startup-team@0.2.0`, dependencies list successfully, and help recognizes workflows and teams.

- [ ] **Step 5: Run the full quality gate**

```bash
rtk bun run check
```

Expected: Biome, TypeScript, all Bun tests, and the 90% coverage gate pass.

- [ ] **Step 6: Confirm the branch is clean and review the commit sequence**

```bash
rtk git status --short --branch
rtk git log --oneline --decorate -8
```

Expected: `codex/startup-team-manifest` has no uncommitted implementation files and contains the design, schema, catalog, bundle, CLI, documentation, and landing commits in order.

## Clean-install amendment

Post-implementation smoke testing in a clean home found that the planned bare
`implement` source could not bootstrap for a fresh user. The verified fix is to
change the retained dependency and its step reference to
`mattpocock:implement`, pin its repository to
`https://github.com/mattpocock/skills/tree/v1.1.0`, regenerate the lock, and
assert that the real startup-team manifest contains no bare `implement`
dependency. This is the only intentional deviation from the plan's exact
skills/steps retention; the installed skill remains named `implement`.
